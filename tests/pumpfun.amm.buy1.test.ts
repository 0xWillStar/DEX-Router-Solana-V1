import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { DexSolana } from "../target/types/dex_solana";
import { PublicKey, VersionedTransaction, TransactionMessage, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress, userVolumeAccumulatorPda, transferSOL } from "./util";

describe("pumpfun.amm.buy test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dexSolana as Program<DexSolana>;

  const saAuthority = new PublicKey("EMeFFvHcarJGS9jPcJu4qeugSmXJn3BJUm53QYv4P9Pk");

  // https://solscan.io/tx/3Y6RYZAuJER7HLeZXWwD9Rv8KgDQpRWoUNZx27qXNDqXcbhGTDWPhENyM6pyFbUJqZqh2YW3JiKfxtKm1VA3GeWg
// [[test.validator.clone]]
// address = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA" # pumpfun amm
// [[test.validator.clone]]
// address = "6EfDrEwGcdm5fjeFJuAfBpi1SAJjKtHmnFnJeBChghEg" # pool
// [[test.validator.clone]]
// address = "ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw" # global_config
// [[test.validator.clone]]
// address = "7fwejnkopLFAmoyiHQiV8efqQhGYPRcZj5p31fvkpump" # base_mint
// [[test.validator.clone]]
// address = "8Bj2QEwFa7y38w1C8pTwgp86dceL2Bm2vNHqK5kiPkHi" # pool_base_token_account
// [[test.validator.clone]]
// address = "DbyUXqoZgmeNXsRhMDanahmqdhdNQg6STEPLQArifWP6" # pool_quote_token_account
// [[test.validator.clone]]
// address = "JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU" # protocol_fee_recipient
// [[test.validator.clone]]
// address = "DWpvfqzGWuVy9jVSKSShdM2733nrEsnnhsUStYbkj6Nn" # protocol_fee_recipient_token_account
// [[test.validator.clone]]
// address = "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR" # event_authority
// [[test.validator.clone]]
// address = "8ouSp8tD8jmXzMphnViVxjeCWrfqRKpNaRGfus2Ba2ni" # coin_creator_vault_ata
// [[test.validator.clone]]
// address = "C2aFPdENg4A2HQsmrd5rTw5TaYBX5Ku887cWjbFKtZpw" # global_volume_accumulator
// [[test.validator.clone]]
// address = "5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx" # fee_config
// [[test.validator.clone]]
// address = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ" # fee_program
  it("buy3-no cashback", async () => {
    const FEE_ACCOUNT = new PublicKey("GJHUsZwxMj6CaMznx5x23GX3Ka7d334H3473RdmjSAv5");

    // Account addresses
    const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const BASE_MINT = new PublicKey("7fwejnkopLFAmoyiHQiV8efqQhGYPRcZj5p31fvkpump");
    
    const provider = anchor.getProvider();
    const wallet = provider.wallet.publicKey;
    console.log("wallet: ", wallet.toBase58());

    // Transfer 1 SOL to saAuthority
    console.log("Transferring 1 SOL to saAuthority...");
    await transferSOL(saAuthority, 1_000_000_000, wallet);

    // Initialize wallet's ATA accounts
    console.log("\nInitializing wallet's ATA accounts...");
    const sourceTokenAccount = await initializeATA(WSOL_MINT, wallet);
    const destinationTokenAccount = await initializeATA(BASE_MINT, wallet);

    // Transfer SOL to sourceTokenAccount
    await wrapSOL(sourceTokenAccount, 2_000_000_000);

    const sourceTokenSa = await getATAAddress(WSOL_MINT, saAuthority);
    console.log("sourceTokenSa: ", sourceTokenSa.toBase58());
    const destinationTokenSa = await getATAAddress(BASE_MINT, saAuthority);
    console.log("destinationTokenSa: ", destinationTokenSa.toBase58());

    const userVolumeAccumulator = userVolumeAccumulatorPda(saAuthority);

    const pumpfunammBuy3AccountsConfig = [
      { pubkey: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"), isSigner: false, isWritable: false }, // pumpfunamm program
      { pubkey: saAuthority, isSigner: false, isWritable: true }, // saAuthority is a PDA, signed by program using seeds, no external signature needed
      { pubkey: sourceTokenSa, isSigner: false, isWritable: true },
      { pubkey: destinationTokenSa, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("6EfDrEwGcdm5fjeFJuAfBpi1SAJjKtHmnFnJeBChghEg"), isSigner: false, isWritable: true },  // pool
      { pubkey: new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw"), isSigner: false, isWritable: false }, // global_config
      { pubkey: new PublicKey("7fwejnkopLFAmoyiHQiV8efqQhGYPRcZj5p31fvkpump"), isSigner: false, isWritable: false }, // base_mint
      { pubkey: new PublicKey("So11111111111111111111111111111111111111112"), isSigner: false, isWritable: false }, // quote_mint
      { pubkey: new PublicKey("8Bj2QEwFa7y38w1C8pTwgp86dceL2Bm2vNHqK5kiPkHi"), isSigner: false, isWritable: true }, // pool_base_token_account
      { pubkey: new PublicKey("DbyUXqoZgmeNXsRhMDanahmqdhdNQg6STEPLQArifWP6"), isSigner: false, isWritable: true }, // pool_quote_token_account
      { pubkey: new PublicKey("JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU"), isSigner: false, isWritable: false }, // protocol_fee_recipient
      { pubkey: new PublicKey("DWpvfqzGWuVy9jVSKSShdM2733nrEsnnhsUStYbkj6Nn"), isSigner: false, isWritable: true }, // protocol_fee_recipient_token_account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // base_token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // quote_token_program
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false }, // system_program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: new PublicKey("GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR"), isSigner: false, isWritable: false }, // event_authority
      { pubkey: new PublicKey("8ouSp8tD8jmXzMphnViVxjeCWrfqRKpNaRGfus2Ba2ni"), isSigner: false, isWritable: true }, // coin_creator_vault_ata
      { pubkey: new PublicKey("FrpXQDwiQjTsxWi1GjcAfQ8WXtiwUSo8PJrbzd8HeAkj"), isSigner: false, isWritable: false }, // coin_creator_vault_authority
      { pubkey: new PublicKey("C2aFPdENg4A2HQsmrd5rTw5TaYBX5Ku887cWjbFKtZpw"), isSigner: false, isWritable: true }, // global_volume_accumulator
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true }, // user_volume_accumulator
      { pubkey: new PublicKey("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx"), isSigner: false, isWritable: false }, // fee_config
      { pubkey: new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"), isSigner: false, isWritable: false }, // fee_program
      { pubkey: new PublicKey("9S3HCEX9BtBVJ9Kx1ZUVtvEeEJYWKoujqmr1CCCsJKv2"), isSigner: false, isWritable: false }, // pool_v2
    ];

    // Build SwapArgs
    const swapArgs = {
      amountIn: new BN(1000000),
      expectAmountOut: new BN(133643),
      minReturn: new BN(133000),
      amounts: [new BN(1000000)], // Only one route, so only one amount
      routes: [
        [
          {
            dexes: [{ pumpfunammBuy3: {} }],
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
        sourceMint: WSOL_MINT,   // ！！！！！！don't forget to change this
        destinationMint: BASE_MINT,   // ！！！！！！don't forget to change this
        commissionAccount: FEE_ACCOUNT,
        platformFeeAccount: FEE_ACCOUNT,
        saAuthority: saAuthority,
        sourceTokenSa: sourceTokenSa,
        destinationTokenSa: destinationTokenSa,
        sourceTokenProgram: TOKEN_PROGRAM_ID,   // ！！！！！！don't forget to change this
        destinationTokenProgram: TOKEN_PROGRAM_ID,   // ！！！！！！don't forget to change this
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