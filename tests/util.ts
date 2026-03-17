import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getMint,
  getAccount,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
} from "@solana/spl-token";

export async function initializeATA(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const provider = anchor.getProvider();

  // Detect which token program this mint belongs to (Token-2022 or legacy)
  const mintAccountInfo = await provider.connection.getAccountInfo(mint);
  const tokenProgramId = mintAccountInfo?.owner ?? TOKEN_PROGRAM_ID;

  // Calculate ATA account address
  const ataAddress = await getAssociatedTokenAddress(
    mint,
    owner,
    true, // allowOwnerOffCurve
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Check if account already exists
  const accountInfo = await provider.connection.getAccountInfo(ataAddress);
  if (accountInfo) {
    console.log(
      `ATA account already exists: ${ataAddress.toBase58()} (mint: ${mint.toBase58()}, owner: ${owner.toBase58()})`
    );
    return ataAddress;
  }

  // Create ATA account instruction
  const createATAInstruction = createAssociatedTokenAccountInstruction(
    provider.wallet.publicKey, // payer
    ataAddress, // ata
    owner, // owner
    mint, // mint
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Build and send transaction
  const transaction = new Transaction().add(createATAInstruction);
  const signature = await provider.sendAndConfirm(transaction);

  console.log(
    `ATA account initialized successfully: ${ataAddress.toBase58()} (mint: ${mint.toBase58()}, owner: ${owner.toBase58()})`
  );
  return ataAddress;
}

export async function getATAAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  const provider = anchor.getProvider();

  const mintAccountInfo = await provider.connection.getAccountInfo(mint);
  const tokenProgramId = mintAccountInfo?.owner ?? TOKEN_PROGRAM_ID;

  return await getAssociatedTokenAddress(
    mint,
    owner,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export async function wrapSOL(
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
  console.log(
    `Successfully transferred ${amount / 1_000_000_000} SOL to ${tokenAccount.toBase58()}`
  );

  return wrapSignature;
}

export async function unwrapSOL(
  tokenAccount: PublicKey,
  toWallet?: PublicKey
): Promise<string> {
  const provider = anchor.getProvider();
  const wallet = toWallet || provider.wallet.publicKey;

  // Create close account instruction to unwrap WSOL back to SOL
  // Closing the WSOL account will transfer the lamports back to the destination
  const closeAccountInstruction = createCloseAccountInstruction(
    tokenAccount, // account to close (WSOL token account)
    wallet, // destination to receive the lamports
    wallet, // authority (owner of the token account)
    [], // multisig signers (empty for single signature)
    TOKEN_PROGRAM_ID
  );

  // Build and send close account transaction
  const unwrapTransaction = new Transaction().add(closeAccountInstruction);
  const unwrapSignature = await provider.sendAndConfirm(unwrapTransaction);
  console.log(
    `Successfully unwrapped WSOL from ${tokenAccount.toBase58()} to ${wallet.toBase58()}`
  );

  return unwrapSignature;
}

export async function transferSOL(
  toPubkey: PublicKey,
  amountLamports: number = 1_000_000_000,
  fromWallet?: PublicKey
): Promise<string> {
  const provider = anchor.getProvider();
  const wallet = fromWallet || provider.wallet.publicKey;

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: wallet,
    toPubkey,
    lamports: amountLamports,
  });

  const transaction = new Transaction().add(transferInstruction);
  const signature = await provider.sendAndConfirm(transaction);

  console.log(
    `Successfully transferred ${amountLamports / 1_000_000_000} SOL to ${toPubkey.toBase58()}`
  );

  return signature;
}

export async function mintIfNeeded(
  mint: PublicKey,
  tokenAccount: PublicKey,
  minAmount: bigint = BigInt(0),
  mintAmount: bigint = BigInt(1_000_000)
): Promise<string | null> {
  const provider = anchor.getProvider();
  const wallet = provider.wallet.publicKey;

  try {
    // Detect which token program this mint belongs to (Token-2022 or legacy)
    const mintAccountInfo = await provider.connection.getAccountInfo(mint);
    const tokenProgramId = mintAccountInfo?.owner ?? TOKEN_PROGRAM_ID;

    const mintInfo = await getMint(provider.connection, mint, undefined, tokenProgramId);
    const mintAuthority = mintInfo.mintAuthority;

    if (!mintAuthority || !mintAuthority.equals(wallet)) {
      console.log(
        `Wallet ${wallet.toBase58()} is not the mint authority for ${mint.toBase58()}. Skipping mint.`
      );
      return null;
    }

    let tokenAccountInfo;
    try {
      tokenAccountInfo = await getAccount(provider.connection, tokenAccount, undefined, tokenProgramId);
    } catch (error) {
      console.log(
        `Token account ${tokenAccount.toBase58()} does not exist. Skipping mint.`
      );
      return null;
    }

    if (tokenAccountInfo.amount >= minAmount) {
      console.log(
        `Token account ${tokenAccount.toBase58()} has sufficient balance: ${tokenAccountInfo.amount.toString()}. Skipping mint.`
      );
      return null;
    }

    console.log(
      `Token account ${tokenAccount.toBase58()} has insufficient balance: ${tokenAccountInfo.amount.toString()}. Minting ${mintAmount.toString()} tokens...`
    );

    const mintInstruction = createMintToInstruction(
      mint,
      tokenAccount,
      wallet,
      Number(mintAmount),
      [], // multiSigners
      tokenProgramId
    );

    const transaction = new Transaction().add(mintInstruction);
    const signature = await provider.sendAndConfirm(transaction);

    console.log(
      `Successfully minted ${mintAmount.toString()} tokens to ${tokenAccount.toBase58()}. Signature: ${signature}`
    );

    return signature;
  } catch (error) {
    console.error(`Error in mintIfNeeded:`, error);
    throw error;
  }
}

export const PUMP_AMM_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
);

export function pumpAmmPda(seeds: Array<Buffer | Uint8Array>) {
  return PublicKey.findProgramAddressSync(seeds, PUMP_AMM_PROGRAM_ID)[0];
}

export function userVolumeAccumulatorPda(user: PublicKey): PublicKey {
  return pumpAmmPda([Buffer.from("user_volume_accumulator"), user.toBuffer()]);
}
