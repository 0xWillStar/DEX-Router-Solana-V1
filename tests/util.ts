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
  AuthorityType,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
} from "@solana/spl-token";

export async function initializeATA(
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
    TOKEN_PROGRAM_ID,
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
  return await getAssociatedTokenAddress(mint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
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
