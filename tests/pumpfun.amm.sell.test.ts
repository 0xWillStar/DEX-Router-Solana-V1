import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress, userVolumeAccumulatorPda, transferSOL, mintIfNeeded } from "./util";

describe("pumpfun.amm.sell test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  const saAuthority = new PublicKey("EMeFFvHcarJGS9jPcJu4qeugSmXJn3BJUm53QYv4P9Pk");

// [[test.validator.clone]]
// address = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA" # pumpfun amm
// [[test.validator.clone]]
// address = "BSFWC5p9PswcFpoLkv19SLeXCBHx1FeQMVgnhmPwtfdK" # pool
// [[test.validator.clone]]
// address = "ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw" # global_config
// [[test.validator.clone]]
// address = "5NBjUzyjv9LgMdpWxWxWSdoY5sFGVRiozLGkPS4Lk87J" # pool_base_token_account
// [[test.validator.clone]]
// address = "9xAWctDwpqDkHZ3WP2qc9TGNMqmXWYqTAUwuEDjRxZBT" # pool_quote_token_account
// [[test.validator.clone]]
// address = "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV" # protocol_fee_recipient
// [[test.validator.clone]]
// address = "94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb" # protocol_fee_recipient_token_account
// [[test.validator.clone]]
// address = "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR" # event_authority
// [[test.validator.clone]]
// address = "GDfqKXYUX3cppMPwrgmP5WcUy2YLJZMeUDxYV5bg9mVg" # coin_creator_vault_ata
// [[test.validator.clone]]
// address = "5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx" # fee_config
// [[test.validator.clone]]
// address = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ" # fee_program
  it("sell3", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const BASE_MINT = new PublicKey("DZBDHnfn3McJpf8QXQ1PVsnE7VTZ2vVLbMZgYq9Qpump");
    
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

    const userVolumeAccumulator = userVolumeAccumulatorPda(saAuthority);
    const userVolumeAccumulatorAccount = await getATAAddress(WSOL_MINT, userVolumeAccumulator);

    const pumpfunammBuy3AccountsConfig = [
      { pubkey: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"), isSigner: false, isWritable: false }, // pumpfunamm program
      { pubkey: saAuthority, isSigner: false, isWritable: true }, // saAuthority is a PDA, signed by program using seeds, no external signature needed
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("BSFWC5p9PswcFpoLkv19SLeXCBHx1FeQMVgnhmPwtfdK"), isSigner: false, isWritable: true },  // pool
      { pubkey: new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw"), isSigner: false, isWritable: false }, // global_config
      { pubkey: new PublicKey("DZBDHnfn3McJpf8QXQ1PVsnE7VTZ2vVLbMZgYq9Qpump"), isSigner: false, isWritable: false }, // base_mint
      { pubkey: new PublicKey("So11111111111111111111111111111111111111112"), isSigner: false, isWritable: false }, // quote_mint
      { pubkey: new PublicKey("5NBjUzyjv9LgMdpWxWxWSdoY5sFGVRiozLGkPS4Lk87J"), isSigner: false, isWritable: true }, // pool_base_token_account
      { pubkey: new PublicKey("9xAWctDwpqDkHZ3WP2qc9TGNMqmXWYqTAUwuEDjRxZBT"), isSigner: false, isWritable: true }, // pool_quote_token_account
      { pubkey: new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"), isSigner: false, isWritable: false }, // protocol_fee_recipient
      { pubkey: new PublicKey("94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb"), isSigner: false, isWritable: true }, // protocol_fee_recipient_token_account
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // base_token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // quote_token_program
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false }, // system_program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: new PublicKey("GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR"), isSigner: false, isWritable: false }, // event_authority
      { pubkey: new PublicKey("GDfqKXYUX3cppMPwrgmP5WcUy2YLJZMeUDxYV5bg9mVg"), isSigner: false, isWritable: true }, // coin_creator_vault_ata
      { pubkey: new PublicKey("CvdxEzWWKNR6WtLcgjFcvn9ndSufpiMTFaZgbrmQcLQb"), isSigner: false, isWritable: false }, // coin_creator_vault_authority
      { pubkey: new PublicKey("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx"), isSigner: false, isWritable: false }, // fee_config
      { pubkey: new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"), isSigner: false, isWritable: false }, // fee_program
      { pubkey: userVolumeAccumulatorAccount, isSigner: false, isWritable: true }, // user_volume_accumulator_account
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true }, // userVolumeAccumulator
      { pubkey: new PublicKey("492ksfMaivinfJpyazaHyM99a74kAXm8SRcS7zFimbqM"), isSigner: false, isWritable: false }, // pool_v2
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
            dexes: [{ pumpfunammSell3: {} }],
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
      .remainingAccounts(pumpfunammBuy3AccountsConfig)
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