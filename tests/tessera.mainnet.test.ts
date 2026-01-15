import * as anchor from "@coral-xyz/anchor";
import { Program, BN, Idl } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, Connection, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress } from "./util";
import * as fs from "fs";
import * as path from "path";

import dexSolanaIDL from '../target/idl/dex_solana.json';

describe("tessera mainnet test", () => {
  const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://kora-8cwrc2-fast-mainnet.helius-rpc.com";
  const connection = new Connection(MAINNET_RPC_URL, "confirmed");
  
  const walletPath = process.env.SOLANA_WALLET_PATH || path.join(process.env.HOME || "~", ".config/solana/id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programId = process.env.MAINNET_PROGRAM_ID || "13kxuZC81hWTX1UnDDxQdpTbTgqug5nHJYiMo2bHC3h7";
  const saAuthority = new PublicKey("EMeFFvHcarJGS9jPcJu4qeugSmXJn3BJUm53QYv4P9Pk");
    
  if (dexSolanaIDL.address !== programId) {
    dexSolanaIDL.address = programId;
  }  
  const program = new Program(dexSolanaIDL, provider) as Program<DexSolana>;

  it("swap", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    
    console.log("wallet: ", wallet.publicKey.toBase58());
    console.log("RPC URL: ", MAINNET_RPC_URL);

    const balance = await connection.getBalance(wallet.publicKey);
    console.log("Wallet balance:", balance / 1e9, "SOL");

    // Initialize wallet's ATA accounts
    console.log("\nInitializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(WSOL_MINT, wallet.publicKey);
    const destinationTokenAccount = await initializeATA(USDC_MINT, wallet.publicKey);

    // Transfer SOL to sourceTokenAccount
    // await wrapSOL(sourceTokenAccount, 1_000_000); // 0.001 SOL

    const sourceTokenSa = await getATAAddress(WSOL_MINT, saAuthority);
    const destinationTokenSa = await getATAAddress(USDC_MINT, saAuthority);

    // Accounts and their properties required for RaydiumSwapV2
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
      amountIn: new BN(1_000_000), // 0.001 WSOL
      expectAmountOut: new BN(133_643),
      minReturn: new BN(133_000),
      amounts: [new BN(1_000_000)],
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
        payer: wallet.publicKey,
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

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Convert transaction to VersionedTransaction and add lookup table
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: transaction.instructions,
    }).compileToV0Message([]);

    const versionedTransaction = new VersionedTransaction(messageV0);

    // Sign transaction
    versionedTransaction.sign([walletKeypair]);

    // Simulate transaction first to get detailed error information
    console.log("\nSimulating transaction...");
    const simulation = await connection.simulateTransaction(versionedTransaction, {
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

    // // After successful simulation, send actual transaction
    // console.log("\nSending transaction to mainnet...");
    // const tx = await connection.sendTransaction(versionedTransaction, {
    //   skipPreflight: false,
    //   preflightCommitment: "confirmed",
    // });

    // console.log("Swap transaction signature:", tx);
  });
});
