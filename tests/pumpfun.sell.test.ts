import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress, userVolumeAccumulatorPda1, transferSOL, mintIfNeeded } from "./util";

describe("pumpfun.sell test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  const saAuthority = new PublicKey("EMeFFvHcarJGS9jPcJu4qeugSmXJn3BJUm53QYv4P9Pk");

  // https://solscan.io/tx/kc9iMbPYKXwjT2bZGjYiSrXtiN57Mi8RsJtmdP54uVfxMV66GPr6SqqrhoY99mGo1NmmRKD7yFpXV8HSwohVy7o
// [[test.validator.clone]]
// address = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" # pumpfun
// [[test.validator.clone]]
// address = "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf" # global
// [[test.validator.clone]]
// address = "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV" # fee_recipient
// [[test.validator.clone]]
// address = "CpUqTa2ayWZBmoxL51A1W9ytjptvE6cLdhwhpFVNHN3p" # bonding_curve
// [[test.validator.clone]]
// address = "44NP7DtbsBiMBYzV4rsmmo55qsaCgTfd8AgPYywbi4hd" # associated_bonding_curve
// [[test.validator.clone]]
// address = "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1" # event_authority
// [[test.validator.clone]]
// address = "8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt" # fee_config
// [[test.validator.clone]]
// address = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ" # fee_program
  it("sell2-cashback", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const BASE_MINT = new PublicKey("DTvbmZ8svcJ9Ke68urvmG9E1groaSE55m3c2rLM2pump");
    
    const provider = anchor.getProvider();
    const wallet = provider.wallet.publicKey;
    console.log("wallet: ", wallet.toBase58());

    // Transfer 1 SOL to saAuthority
    console.log("Transferring 1 SOL to saAuthority...");
    await transferSOL(saAuthority, 1_000_000_000, wallet);

    // Initialize wallet's ATA accounts
    console.log("\nInitializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(BASE_MINT, wallet);
    const destinationTokenAccount = await initializeATA(WSOL_MINT, wallet);

    console.log("\nChecking if mint is needed for BASE_MINT...");
    await mintIfNeeded(BASE_MINT, sourceTokenAccount, BigInt(1_000_000_000), BigInt(1_000_000_000));


    const sourceTokenSa = await getATAAddress(BASE_MINT, saAuthority);
    console.log("sourceTokenSa: ", sourceTokenSa.toBase58());
    const destinationTokenSa = await getATAAddress(WSOL_MINT, saAuthority);
    console.log("destinationTokenSa: ", destinationTokenSa.toBase58());

    const userVolumeAccumulator = userVolumeAccumulatorPda1(saAuthority);

    const pumpfunSell2AccountsConfig = [
      { pubkey: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), isSigner: false, isWritable: false }, // pumpfun program
      { pubkey: saAuthority, isSigner: false, isWritable: true }, // saAuthority is a PDA, signed by program using seeds, no external signature needed
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"), isSigner: false, isWritable: false },  // global
      { pubkey: new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"), isSigner: false, isWritable: true }, // fee_recipient
      { pubkey: new PublicKey("DTvbmZ8svcJ9Ke68urvmG9E1groaSE55m3c2rLM2pump"), isSigner: false, isWritable: false }, // mint
      { pubkey: new PublicKey("CpUqTa2ayWZBmoxL51A1W9ytjptvE6cLdhwhpFVNHN3p"), isSigner: false, isWritable: true }, // bonding_curve
      { pubkey: new PublicKey("44NP7DtbsBiMBYzV4rsmmo55qsaCgTfd8AgPYywbi4hd"), isSigner: false, isWritable: true }, // associated_bonding_curve
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false }, // system_program
      { pubkey: new PublicKey("HkVWUATjPD5hFGxRheYdDtp7odTrsm8qEpx8nRQmK3fT"), isSigner: false, isWritable: true }, // creator_vault
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // wsol_program
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      { pubkey: new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"), isSigner: false, isWritable: false }, // event_authority
      { pubkey: new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt"), isSigner: false, isWritable: false }, // fee_config
      { pubkey: new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"), isSigner: false, isWritable: false }, // fee_program
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true }, // userVolumeAccumulator
      { pubkey: new PublicKey("2NhEPNqTiPcja17JQBsYUtw96UQxh2dc2SixJDrpz5XX"), isSigner: false, isWritable: false }, // pool_v2
    ];

    // Build SwapArgs
    const swapArgs = {
      amountIn: new BN(100000000),
      expectAmountOut: new BN(133643),
      minReturn: new BN(1),
      amounts: [new BN(100000000)], // Only one route, so only one amount
      routes: [
        [
          {
            dexes: [{ pumpfunSell2: {} }],
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
        sourceTokenAccount: sourceTokenAccount,
        destinationTokenAccount: destinationTokenAccount,
        sourceMint: BASE_MINT,  // ！！！！！！don't forget to change this
        destinationMint: WSOL_MINT,  // ！！！！！！don't forget to change this
        commissionAccount: FEE_ACCOUNT,
        platformFeeAccount: FEE_ACCOUNT,
        saAuthority: saAuthority,
        sourceTokenSa: sourceTokenSa,
        destinationTokenSa: destinationTokenSa,
        sourceTokenProgram: TOKEN_2022_PROGRAM_ID,  // ！！！！！！don't forget to change this
        destinationTokenProgram: TOKEN_PROGRAM_ID,  // ！！！！！！don't forget to change this
      })
      .preInstructions([computeBudgetIx])
      .remainingAccounts(pumpfunSell2AccountsConfig)
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