import * as anchor from "@coral-xyz/anchor";
import { Program, BN, Idl } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, Connection, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress } from "./util";
import * as fs from "fs";
import * as path from "path";

import dexSolanaIDL from '../target/idl/dex_solana.json';

describe("raydium mainnet test", () => {
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

  const programId = process.env.MAINNET_PROGRAM_ID || "GUTKWQrx3tgfCBZPRgTQy3pL57KsRHDSZTMeyhWbCNTc";
  const saAuthority = new PublicKey("7su8FX45KEdRMsbmP5z3R2hQzHGtyL8gjL42NTUgnsFL");
  
  if (dexSolanaIDL.address !== programId) {
    dexSolanaIDL.address = programId;
  }  
  const program = new Program(dexSolanaIDL, provider) as Program<DexSolana>;

  it("swap_v2", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    
    console.log("wallet: ", wallet.publicKey.toBase58());
    console.log("RPC URL: ", MAINNET_RPC_URL);

    const balance = await connection.getBalance(wallet.publicKey);
    console.log("Wallet balance:", balance / 1e9, "SOL");

    // Initialize wallet's ATA accounts
    console.log("Initializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(WSOL_MINT, wallet.publicKey);
    const destinationTokenAccount = await initializeATA(USDC_MINT, wallet.publicKey);

    // Transfer SOL to sourceTokenAccount
    // await wrapSOL(sourceTokenAccount, 1_000_000); // 0.001 SOL

    // Initialize saAuthority's ATA accounts
    console.log("\nInitializing saAuthority's ATA accounts...");
    // const sourceTokenSa = await initializeATA(WSOL_MINT, saAuthority);
    // const destinationTokenSa = await initializeATA(USDC_MINT, saAuthority);
    const sourceTokenSa = await getATAAddress(WSOL_MINT, saAuthority);
    const destinationTokenSa = await getATAAddress(USDC_MINT, saAuthority);

    // Address lookup table
    const lookupTableAddress = new PublicKey("8rG5WFRriQYz3SiYSjB2V7TVCqJiTfur23foeRkWLD67");
    const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress);
    
    if (!lookupTableAccount.value) {
      throw new Error("Address lookup table not found");
    }
    console.log("\nlookupTableAccount: ", lookupTableAccount.value.key.toBase58());
    console.log("lookupTableAccount addresses count: ", lookupTableAccount.value.state.addresses.length);

    // Accounts and their properties required for RaydiumSwapV2
    const raydiumAccountsConfig = [
      { pubkey: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), isSigner: false, isWritable: false },
      { pubkey: saAuthority, isSigner: false, isWritable: true },
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz"), isSigner: false, isWritable: true },
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
            dexes: [{ raydiumSwapV2: {} }],
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
      .remainingAccounts(raydiumAccountsConfig)
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
    }).compileToV0Message([lookupTableAccount.value]);

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

    // if (process.env.SKIP_SEND === "true") {
    //   console.log("\nSkipping transaction send (SKIP_SEND=true). Transaction prepared but not sent.");
    //   return;
    // }

    // // After successful simulation, send actual transaction
    // console.log("\nSending transaction to mainnet...");
    // const tx = await connection.sendTransaction(versionedTransaction, {
    //   skipPreflight: false,
    //   preflightCommitment: "confirmed",
    // });

    // console.log("Swap transaction signature:", tx);
  });
});
