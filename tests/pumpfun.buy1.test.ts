import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, userVolumeAccumulatorPda1, mintIfNeeded, createTokenAccount } from "./util";

describe("pumpfun.buy test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  const saAuthority = new PublicKey("EMeFFvHcarJGS9jPcJu4qeugSmXJn3BJUm53QYv4P9Pk");

  // https://solscan.io/tx/4tbzv81FAm8czXLGvm9h51KmsXnajLPDzaxQibZNsvCEuc53MbshhYtuzfx4zQnLgyx3p18c59JVswgGVd14Pcsn
// [[test.validator.clone]]
// address = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" # pumpfun
// [[test.validator.clone]]
// address = "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf" # global
// [[test.validator.clone]]
// address = "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV" # fee_recipient
// [[test.validator.clone]]
// address = "Fsz5nhsr1VsxkRtxqVcKKvysqvJRDUebZQrFNJ8Jpump" # mint
// [[test.validator.clone]]
// address = "9Wic4kR2DoMVnMSSYeBWAKktGrCTn1HyWyqpeyxKHFD5" # bonding_curve
// [[test.validator.clone]]
// address = "E8kmM8tKPZpKZXKrypvw66mUsNyqvJoqv3FsN35zTv9H" # associated_bonding_curve
// [[test.validator.clone]]
// address = "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1" # event_authority
// [[test.validator.clone]]
// address = "Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y" # global_volume_accumulator
// [[test.validator.clone]]
// address = "8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt" # fee_config
// [[test.validator.clone]]
// address = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ" # fee_program
  it("buy2-no cashback", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const BASE_MINT = new PublicKey("Fsz5nhsr1VsxkRtxqVcKKvysqvJRDUebZQrFNJ8Jpump");
    
    const provider = anchor.getProvider();
    const wallet = provider.wallet.publicKey;
    console.log("wallet: ", wallet.toBase58());

    // Initialize wallet's ATA accounts
    console.log("\nInitializing wallet's ATA accounts...");
    const destinationTokenAccount = await initializeATA(BASE_MINT, wallet);

    const userVolumeAccumulator = userVolumeAccumulatorPda1(wallet);

    // Use a temporary WSOL token account owned by wallet as swap source.
    // Pumpfun buy closes swap_source_token; using a temp account avoids closing wallet's ATA.
    const amountIn = 5_000_000; // 0.005 SOL
    const { publicKey: tempUserWsol } = await createTokenAccount(WSOL_MINT, wallet, TOKEN_PROGRAM_ID);
    await wrapSOL(tempUserWsol, amountIn);

    const pumpfunBuy2AccountsConfig = [
      { pubkey: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), isSigner: false, isWritable: false }, // pumpfun program
      { pubkey: wallet, isSigner: true, isWritable: true }, // swap authority (wallet signs)
      { pubkey: tempUserWsol, isSigner: false, isWritable: true }, // swap source token (will be closed)
      { pubkey: destinationTokenAccount, isSigner: false, isWritable: true }, // swap destination token (wallet ATA)
      { pubkey: new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"), isSigner: false, isWritable: false },  // global
      { pubkey: new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"), isSigner: false, isWritable: true }, // fee_recipient
      { pubkey: new PublicKey("Fsz5nhsr1VsxkRtxqVcKKvysqvJRDUebZQrFNJ8Jpump"), isSigner: false, isWritable: false }, // mint
      { pubkey: new PublicKey("9Wic4kR2DoMVnMSSYeBWAKktGrCTn1HyWyqpeyxKHFD5"), isSigner: false, isWritable: true }, // bonding_curve
      { pubkey: new PublicKey("E8kmM8tKPZpKZXKrypvw66mUsNyqvJoqv3FsN35zTv9H"), isSigner: false, isWritable: true }, // associated_bonding_curve
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false }, // system_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // wsol_program
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      { pubkey: new PublicKey("3rt3dmQehsppSyW2CB8yoRRxQXefiF2FGk7CUEphB81F"), isSigner: false, isWritable: true }, // creator_vault
      { pubkey: new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"), isSigner: false, isWritable: false }, // event_authority
      { pubkey: new PublicKey("Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y"), isSigner: false, isWritable: true }, // global_volume_accumulator
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true }, // user_volume_accumulator
      { pubkey: new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt"), isSigner: false, isWritable: false }, // fee_config
      { pubkey: new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"), isSigner: false, isWritable: false }, // fee_program
      { pubkey: new PublicKey("ARvGrRujot6J9qYoTEQHUUihuKmP3uMmAYqNsnShs9Zo"), isSigner: false, isWritable: false }, // pool_v2
    ];

    // Build SwapArgs
    const swapArgs = {
      amountIn: new BN(amountIn),
      expectAmountOut: new BN(1),
      minReturn: new BN(1),
      amounts: [new BN(amountIn)], // Only one route, so only one amount
      routes: [
        [
          {
            dexes: [{ pumpfunBuy2: {} }],
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
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 600_000,
    });

    const transaction = await program.methods
      .swapV3(swapArgs, commissionInfo, platformFeeRate, orderId)
      .accounts({
        payer: anchor.getProvider().wallet.publicKey,
        sourceTokenAccount: tempUserWsol,
        destinationTokenAccount: destinationTokenAccount,
        sourceMint: WSOL_MINT,  // ！！！！！！don't forget to change this
        destinationMint: BASE_MINT,  // ！！！！！！don't forget to change this
        commissionAccount: FEE_ACCOUNT,
        platformFeeAccount: FEE_ACCOUNT,
        saAuthority: null,
        sourceTokenSa: null,
        destinationTokenSa: null,
        sourceTokenProgram: TOKEN_PROGRAM_ID,  // ！！！！！！don't forget to change this
        destinationTokenProgram: TOKEN_2022_PROGRAM_ID,  // ！！！！！！don't forget to change this
      })
      .preInstructions([computeBudgetIx])
      .remainingAccounts(pumpfunBuy2AccountsConfig)
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
      console.error(
        "Logs:\n" + (simulation.value.logs ? simulation.value.logs.join("\n") : "<no logs>")
      );
      console.error("Compute units consumed:", simulation.value.unitsConsumed);
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    console.log("Simulation successful! Compute units consumed:", simulation.value.unitsConsumed);
    if (simulation.value.logs) {
      console.log("\nSimulation logs:\n" + simulation.value.logs.join("\n"));
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