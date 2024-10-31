require("dotenv").config();

import { Keypair, Connection } from "@solana/web3.js";

import { onBundleResult, sendBundles } from "./utils";
import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import bs58 from "bs58";

const main = async () => {
	const blockEngineUrl = process.env.BLOCK_ENGINE_URL || "";
	console.log("BLOCK_ENGINE_URL:", blockEngineUrl);

	// const authKeypairPath = process.env.JITO_AUTH_PRIVATE_KEY || "";
	// console.log("AUTH_KEYPAIR_PATH:", authKeypairPath);

	// const decodedKey = new Uint8Array(
	// 	JSON.parse(Fs.readFileSync(authKeypairPath).toString()) as number[]
	// );
	// const keypair = Keypair.fromSecretKey(decodedKey);

	const keypair = Keypair.fromSecretKey(
		bs58.decode(process.env.JITO_AUTH_PRIVATE_KEY!)
	);
	console.log(
		"🚀 ~ file: simple_bundle.ts:24 ~ main ~ keypair:",
		keypair.publicKey.toBase58()
	);

	// const _accounts = (process.env.ACCOUNTS_OF_INTEREST || "").split(",");
	// console.log("ACCOUNTS_OF_INTEREST:", _accounts);
	// const accounts = _accounts.map(a => new PublicKey(a));

	const bundleTransactionLimit = parseInt(
		process.env.BUNDLE_TRANSACTION_LIMIT || "0"
	);

	const c = searcherClient(blockEngineUrl, undefined);

	const rpcUrl = process.env.RPC_URL || "";
	console.log("RPC_URL:", rpcUrl);
	const conn = new Connection(rpcUrl, "confirmed");

	await sendBundles(c, bundleTransactionLimit, keypair, conn);
	// onBundleResult(c);
};

main()
	.then(() => {
		console.log("Sending bundle");
	})
	.catch((e) => {
		throw e;
	});
