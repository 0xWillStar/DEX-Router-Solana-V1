import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, Transaction, SystemProgram } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";

describe("my-router", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  async function initializeATA(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const provider = anchor.getProvider();
    
    // Calculate ATA account address
    const ataAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if account already exists
    const accountInfo = await provider.connection.getAccountInfo(ataAddress);
    if (accountInfo) {
      console.log(`ATA account already exists: ${ataAddress.toBase58()} (mint: ${mint.toBase58()}, owner: ${owner.toBase58()})`);
      return ataAddress;
    }

    // Create ATA account instruction
    const createATAInstruction = createAssociatedTokenAccountInstruction(
      provider.wallet.publicKey, // payer
      ataAddress, // ata
      owner, // owner
      mint, // mint
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Build and send transaction
    const transaction = new Transaction().add(createATAInstruction);
    const signature = await provider.sendAndConfirm(transaction);
    
    console.log(`ATA account initialized successfully: ${ataAddress.toBase58()} (mint: ${mint.toBase58()}, owner: ${owner.toBase58()}, tx: ${signature})`);
    return ataAddress;
  }

  async function wrapSOL(
    tokenAccount: PublicKey,
    amount: number = 1_000_000_000,
    fromWallet?: PublicKey
  ): Promise<string> {
    const provider = anchor.getProvider();
    const wallet = fromWallet || provider.wallet.publicKey;

    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: tokenAccount,
      lamports: amount,
    });

    // Create syncNative instruction to sync WSOL account balance
    const syncNativeInstruction = createSyncNativeInstruction(
      tokenAccount,
      TOKEN_PROGRAM_ID
    );

    // Build and send transfer and sync transaction
    const wrapTransaction = new Transaction().add(
      transferInstruction,
      syncNativeInstruction
    );
    const wrapSignature = await provider.sendAndConfirm(wrapTransaction);
    console.log(`Successfully transferred ${amount / 1_000_000_000} SOL to ${tokenAccount.toBase58()} and synced: ${wrapSignature}`);
    
    return wrapSignature;
  }

  it("swap_v3", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
    const saAuthority = new PublicKey("2ngCpRaYqC5oDDhW8b7p2FR3DeuEn9s75RMybxSAaouV");
    
    const provider = anchor.getProvider();
    const wallet = provider.wallet.publicKey;
    console.log("wallet: ", wallet.toBase58());

    // Initialize wallet's ATA accounts
    console.log("Initializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(WSOL_MINT, wallet);
    const destinationTokenAccount = await initializeATA(USDT_MINT, wallet);

    // Transfer SOL to sourceTokenAccount
    await wrapSOL(sourceTokenAccount, 2_000_000_000);

    // Initialize saAuthority's ATA accounts
    console.log("Initializing saAuthority's ATA accounts...");
    const sourceTokenSa = await initializeATA(WSOL_MINT, saAuthority);
    const destinationTokenSa = await initializeATA(USDT_MINT, saAuthority);

    // Address lookup table
    const lookupTableAddress = new PublicKey("5TLpSPE5T3QJEJKWUTgtg1Vdi5aCu4jAJCjdwL84t1yi");
    const lookupTableAccount = await provider.connection.getAddressLookupTable(lookupTableAddress);
    
    if (!lookupTableAccount.value) {
      throw new Error("Address lookup table not found");
    }
    console.log("\nlookupTableAccount: ", lookupTableAccount.value.key.toBase58());
    console.log("lookupTableAccount addresses count: ", lookupTableAccount.value.state.addresses.length);
    // console.log("lookupTableAccount addresses: ", lookupTableAccount.value.state.addresses.map(addr => addr.toBase58()));

    // Accounts and their properties required for RaydiumSwapV2
    const raydiumAccountsConfig = [
      { pubkey: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), isSigner: false, isWritable: false }, // Raydium swap program
      { pubkey: saAuthority, isSigner: false, isWritable: true }, // saAuthority is a PDA, signed by program using seeds, no external signature needed
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false }, // Token program
      { pubkey: new PublicKey("7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("876Z9waBygfzUrwwKFfnRcc7cfY4EQf6Kz1w7GRgbVYW"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("CB86HtaqpXbNWbq67L18y5x2RhqoJ6smb7xHUcyWdQAQ"), isSigner: false, isWritable: true },
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
            dexes: [{ raydiumSwapV2: {} }], // RaydiumSwapV2
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
        destinationMint: USDT_MINT,
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
    }).compileToV0Message([lookupTableAccount.value]);

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