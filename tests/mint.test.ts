import * as anchor from "@coral-xyz/anchor";
import { Program, BN, Idl } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { MintLayout, MINT_SIZE } from "@solana/spl-token";
import { initializeATA, wrapSOL, getATAAddress } from "./util";
import * as fs from "fs";
import * as path from "path";

// support token-2022
describe("raydium mainnet test", () => {
  const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://kora-8cwrc2-fast-mainnet.helius-rpc.com";
  const connection = new Connection(MAINNET_RPC_URL, "finalized");
  
  const walletPath = process.env.SOLANA_WALLET_PATH || path.join(process.env.HOME || "~", ".config/solana/id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  it("generate mint.json", async () => {
    const mint = new PublicKey("3oe4Wk6JKvT5HGPoQQrpjP3SyRNswEKMT8vj9U8Hpump");
    const walletPubkey = walletKeypair.publicKey;
    
    const accountInfo = await connection.getAccountInfo(mint, { commitment: "finalized" });
    if (!accountInfo) {
      throw new Error(`Mint account ${mint.toBase58()} not found`);
    }
    
    const rawMint = MintLayout.decode(accountInfo.data.subarray(0, MINT_SIZE));

    const modifiedRawMint = {
      ...rawMint,
      mintAuthorityOption: 1 as const,
      mintAuthority: walletPubkey,
    };

    const encodedData = Buffer.alloc(MINT_SIZE);
    MintLayout.encode(modifiedRawMint, encodedData);

    let finalData = encodedData;
    if (accountInfo.data.length > MINT_SIZE) {
      const tlvData = accountInfo.data.subarray(MINT_SIZE);
      finalData = Buffer.concat([encodedData, tlvData]);
    }

    const base64Data = finalData.toString("base64");

    const accountData = {
      pubkey: mint.toBase58(),
      account: {
        lamports: accountInfo.lamports,
        data: [base64Data, "base64"],
        owner: accountInfo.owner.toBase58(),
        executable: accountInfo.executable,
        rentEpoch: "18446744073709551615",
        space: accountInfo.data.length
      }
    };

    const mintJsonPath = path.join(__dirname, "..", "tests", "mint.json");
    let jsonStr = JSON.stringify(accountData, null, 2);
    jsonStr = jsonStr.replace(
      /"rentEpoch":\s*"18446744073709551615"/,
      '"rentEpoch": 18446744073709551615'
    );
    fs.writeFileSync(mintJsonPath, jsonStr);
    console.log(`Account data written to ${mintJsonPath}`);
  });
});
