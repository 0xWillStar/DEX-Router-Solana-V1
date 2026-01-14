import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress, mintIfNeeded } from "./util";

describe("raydium test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  const saAuthority = new PublicKey("7su8FX45KEdRMsbmP5z3R2hQzHGtyL8gjL42NTUgnsFL");

// [[test.validator.clone]]
// address = "9jwPEoRFzvx5EJzY7QgtYsKKoHMSo63isc8ga42gbonk" # ASC  
// [[test.validator.clone]]
// address = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj" # Raydium Launchpad
// [[test.validator.clone]]
// address = "6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX" # global_config
// [[test.validator.clone]]
// address = "BuM6KDpWiTcxvrpXywWFiw45R2RNH8WURdvqoTDV1BW4" # platform_config
// [[test.validator.clone]]
// address = "Cr2DUkyNn2mL9oyfdHFodsuUeJ8Z2PSQXV7LEUGRc8Hz" # pool_state
// [[test.validator.clone]]
// address = "2XoaAqsaNbp7PLin6WLaudVPWNnKAN1jg51moKcas3dU" # base_vault
// [[test.validator.clone]]
// address = "6pKBmVLbLNfeJNDj9M2wwYHYF3hhtqGczLiaCbTTuEk2" # quote_vault
// [[test.validator.clone]]
// address = "84FqPoha4BJCn4LrXtzFQ73ZEHkbFbXparZMPg7wdDzS" # platform_claim_fee_vault
// [[test.validator.clone]]
// address = "8xP9ZgSwidck42FQetc6VLV5cg4Gbms81ZEcQytWqRf8" # creator_claim_fee_vault
  it("swap_v2", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const BASE_MINT = new PublicKey("9jwPEoRFzvx5EJzY7QgtYsKKoHMSo63isc8ga42gbonk");
    const QUOTE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    
    const provider = anchor.getProvider();
    const wallet = provider.wallet.publicKey;
    console.log("wallet: ", wallet.toBase58());

    // Initialize wallet's ATA accounts
    console.log("\nInitializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(BASE_MINT, wallet);
    const destinationTokenAccount = await initializeATA(QUOTE_MINT, wallet);

    console.log("\nChecking if mint is needed for BASE_MINT...");
    await mintIfNeeded(BASE_MINT, sourceTokenAccount, BigInt(1_000_000_000), BigInt(1_000_000_000));

    // Transfer SOL to sourceTokenAccount
    // await wrapSOL(sourceTokenAccount, 2_000_000_000);

    const sourceTokenSa = await getATAAddress(BASE_MINT, saAuthority);
    const destinationTokenSa = await getATAAddress(QUOTE_MINT, saAuthority);

    // Accounts and their properties required for RaydiumLaunchpad
    const raydiumAccountsConfig = [
      { pubkey: new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"), isSigner: false, isWritable: false },
      { pubkey: saAuthority, isSigner: false, isWritable: true },
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh"), isSigner: false, isWritable: false },   // launchpad_authority
      { pubkey: new PublicKey("6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX"), isSigner: false, isWritable: false },  // global_config
      { pubkey: new PublicKey("BuM6KDpWiTcxvrpXywWFiw45R2RNH8WURdvqoTDV1BW4"), isSigner: false, isWritable: false },  // platform_config
      { pubkey: new PublicKey("Cr2DUkyNn2mL9oyfdHFodsuUeJ8Z2PSQXV7LEUGRc8Hz"), isSigner: false, isWritable: true },   // pool_state
      { pubkey: new PublicKey("2XoaAqsaNbp7PLin6WLaudVPWNnKAN1jg51moKcas3dU"), isSigner: false, isWritable: true },   // base_vault
      { pubkey: new PublicKey("6pKBmVLbLNfeJNDj9M2wwYHYF3hhtqGczLiaCbTTuEk2"), isSigner: false, isWritable: true },   // quote_vault
      { pubkey: BASE_MINT, isSigner: false, isWritable: false },   // base_mint
      { pubkey: QUOTE_MINT, isSigner: false, isWritable: false },   // quote_mint
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // base_token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // quote_token_program
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },   // system_program
      { pubkey: new PublicKey("84FqPoha4BJCn4LrXtzFQ73ZEHkbFbXparZMPg7wdDzS"), isSigner: false, isWritable: true },   // platform_claim_fee_vault
      { pubkey: new PublicKey("8xP9ZgSwidck42FQetc6VLV5cg4Gbms81ZEcQytWqRf8"), isSigner: false, isWritable: true },   // creator_claim_fee_vault
      { pubkey: new PublicKey("2DPAtwB8L12vrMRExbLuyGnC7n2J5LNoZQSejeQGpwkr"), isSigner: false, isWritable: false },  // event_authority
    ];

    // Build SwapArgs
    const swapArgs = {
      amountIn: new BN(1000000),
      expectAmountOut: new BN(133643),
      minReturn: new BN(1),
      amounts: [new BN(1000000)], // Only one route, so only one amount
      routes: [
        [
          {
            dexes: [{ raydiumLaunchpad: {} }], // RaydiumLaunchpad
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

        sourceMint: BASE_MINT,
        destinationMint: QUOTE_MINT,

        commissionAccount: FEE_ACCOUNT,
        platformFeeAccount: FEE_ACCOUNT,
        saAuthority: saAuthority,
        sourceTokenSa: sourceTokenSa,
        destinationTokenSa: destinationTokenSa,
        sourceTokenProgram: TOKEN_PROGRAM_ID,
        destinationTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(raydiumAccountsConfig)
      .transaction();

    // Get latest blockhash
    const { blockhash } = await provider.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = provider.wallet.publicKey;

    // Convert transaction to VersionedTransaction and add lookup table
    const messageV0 = new TransactionMessage({
      payerKey: provider.wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: transaction.instructions,
    }).compileToV0Message([]);

    const versionedTransaction = new VersionedTransaction(messageV0);
    // Simulate transaction first to get detailed error information
    console.log("\nSimulating transaction...");
    const simulation = await provider.connection.simulateTransaction(versionedTransaction, {
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
       // Sign transaction
    const signedTransaction = await provider.wallet.signTransaction(versionedTransaction);
    console.log("\nSending transaction...");
    const tx = await provider.connection.sendTransaction(signedTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log("Swap transaction signature:", tx);
  });
});