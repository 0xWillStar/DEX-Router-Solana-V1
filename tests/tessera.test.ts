import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL } from "./util";

describe("tessera test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  it("swap_v2", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const saAuthority = new PublicKey("2ngCpRaYqC5oDDhW8b7p2FR3DeuEn9s75RMybxSAaouV");
    
    const provider = anchor.getProvider();
    const wallet = provider.wallet.publicKey;
    console.log("wallet: ", wallet.toBase58());

    // Initialize wallet's ATA accounts
    console.log("Initializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(WSOL_MINT, wallet);
    const destinationTokenAccount = await initializeATA(USDC_MINT, wallet);

    // Transfer SOL to sourceTokenAccount
    await wrapSOL(sourceTokenAccount, 2_000_000_000);

    // Initialize saAuthority's ATA accounts
    console.log("\nInitializing saAuthority's ATA accounts...");
    const sourceTokenSa = await initializeATA(WSOL_MINT, saAuthority);
    const destinationTokenSa = await initializeATA(USDC_MINT, saAuthority);

    const tesseraAccountsConfig = [
      { pubkey: new PublicKey("TessVdML9pBGgG9yGks7o4HewRaXVAMuoVj4x83GLQH"), isSigner: false, isWritable: false },
      { pubkey: saAuthority, isSigner: false, isWritable: true },
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("8ekCy2jHHUbW2yeNGFWYJT9Hm9FW7SvZcZK66dSZCDiF"), isSigner: false, isWritable: false }, // global_state
      { pubkey: new PublicKey("FLckHLGMJy5gEoXWwcE68Nprde1D4araK4TGLw4pQq2n"), isSigner: false, isWritable: true }, // pool_account
      { pubkey: new PublicKey("5pVN5XZB8cYBjNLFrsBCPWkCQBan5K5Mq2dWGzwPgGJV"), isSigner: false, isWritable: true }, // base_vault
      { pubkey: new PublicKey("9t4P5wMwfFkyn92Z7hf463qYKEZf8ERVZsGBEPNp8uJx"), isSigner: false, isWritable: true }, // quote_vault
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false }, // base_mint
      { pubkey: USDC_MINT, isSigner: false, isWritable: false }, // quote_mint
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // base_token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // quote_token_program
      { pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"), isSigner: false, isWritable: false }, // instructions_sysvar
    ];

    // Build SwapArgs
    const swapArgs = {
      amountIn: new BN(1000000000),
      expectAmountOut: new BN(133643612),
      minReturn: new BN(133000000),
      amounts: [new BN(1000000000)], // Only one route, so only one amount
      routes: [
        [
          {
            dexes: [{ tessera: {} }],
            weights: Buffer.from([100]), // 100% weight
          },
        ],
      ],
    };

    // commission_info: 0 (no commission)
    const commissionInfo = 0;
    // platform_fee_rate: 0 (no platform fee)
    const platformFeeRate = 0;
    // order_id
    const orderId = new BN(0);

    // Build transaction
    const transaction = await program.methods
      .swapV3(swapArgs, commissionInfo, platformFeeRate, orderId)
      .accounts({
        payer: anchor.getProvider().wallet.publicKey,
        sourceTokenAccount: sourceTokenAccount,
        destinationTokenAccount: destinationTokenAccount,
        sourceMint: WSOL_MINT,
        destinationMint: USDC_MINT,
        commissionAccount: FEE_ACCOUNT,
        platformFeeAccount: FEE_ACCOUNT,
        saAuthority: saAuthority,
        sourceTokenSa: sourceTokenSa,
        destinationTokenSa: destinationTokenSa,
        sourceTokenProgram: TOKEN_PROGRAM_ID,
        destinationTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(tesseraAccountsConfig)
      .transaction();

    // Get latest blockhash with "confirmed" commitment to use the latest slot
    const { blockhash } = await provider.connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = provider.wallet.publicKey;

    // Convert transaction to VersionedTransaction without lookup table
    const messageV0 = new TransactionMessage({
      payerKey: provider.wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: transaction.instructions,
    }).compileToV0Message([]);

    const versionedTransaction = new VersionedTransaction(messageV0);

    // Sign transaction
    const signedTransaction = await provider.wallet.signTransaction(versionedTransaction);

    // Simulate transaction first to get detailed error information
    console.log("\nSimulating transaction...");
    const simulation = await provider.connection.simulateTransaction(signedTransaction, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });

    if (simulation.value.err) {
      console.error("Transaction simulation failed!");
      console.error("Error:", JSON.stringify(simulation.value.err, null, 2));
      console.error("Logs:", simulation.value.logs);
      console.error("Compute units consumed:", simulation.value.unitsConsumed);
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    console.log("Simulation successful! Compute units consumed:", simulation.value.unitsConsumed);
    if (simulation.value.logs) {
      console.log("\nSimulation logs:", simulation.value.logs);
    }

    // After successful simulation, send actual transaction
    console.log("\nSending transaction...");
    const tx = await provider.connection.sendTransaction(signedTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log("Swap transaction signature:", tx);
  });
});