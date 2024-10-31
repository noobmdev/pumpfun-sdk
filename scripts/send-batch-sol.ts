import {
	Connection,
	Keypair,
	SystemProgram,
	AddressLookupTableProgram,
	PublicKey,
	VersionedTransaction,
	TransactionMessage,
	clusterApiUrl,
	TransactionInstruction,
	AddressLookupTableAccount,
	LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { config } from "dotenv";
import { searcher } from "jito-ts";
import bs58 from "bs58";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types.js";
import { isError } from "jito-ts/dist/sdk/block-engine/utils.js";
import { onBundleResult } from "../utils";

config();

const payer = Keypair.fromSecretKey(
	Uint8Array.from(process.env.PRIV_KEY!.split(",").map((e) => +e))
);

async function getV0Transaction(
	connection: Connection,
	user: Keypair,
	instructions: TransactionInstruction[],
	lookupTableAccounts?: AddressLookupTableAccount[]
) {
	// Get the latest blockhash and last valid block height
	const { lastValidBlockHeight, blockhash } =
		await connection.getLatestBlockhash();

	// Create a new transaction message with the provided instructions
	const messageV0 = new TransactionMessage({
		payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
		recentBlockhash: blockhash, // The blockhash of the most recent block
		instructions, // The instructions to include in the transaction
	}).compileToV0Message(lookupTableAccounts ? lookupTableAccounts : undefined);

	// Create a new transaction object with the message
	const transaction = new VersionedTransaction(messageV0);

	// Sign the transaction with the user's keypair
	transaction.sign([user]);

	return { transaction, lastValidBlockHeight, blockhash };
}

async function sendV0Transaction(
	connection: Connection,
	user: Keypair,
	instructions: TransactionInstruction[],
	lookupTableAccounts?: AddressLookupTableAccount[]
) {
	const { transaction, lastValidBlockHeight, blockhash } =
		await getV0Transaction(connection, user, instructions, lookupTableAccounts);

	// Send the transaction to the cluster
	const txid = await connection.sendTransaction(transaction);

	// Confirm the transaction
	await connection.confirmTransaction(
		{
			blockhash: blockhash,
			lastValidBlockHeight: lastValidBlockHeight,
			signature: txid,
		},
		"finalized"
	);
	// Log the transaction URL on the Solana Explorer
	console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}

function waitForNewBlock(connection: Connection, targetHeight: number) {
	console.log(`Waiting for ${targetHeight} new blocks`);
	return new Promise(async (resolve: any) => {
		const { lastValidBlockHeight } = await connection.getLatestBlockhash();

		const intervalId = setInterval(async () => {
			const { lastValidBlockHeight: newValidBlockHeight } =
				await connection.getLatestBlockhash();

			if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
				clearInterval(intervalId);
				resolve();
			}
		}, 1000);
	});
}

async function initializeLookupTable(
	user: Keypair,
	connection: Connection,
	addresses: PublicKey[]
): Promise<PublicKey> {
	const slot = await connection.getSlot();

	const [lookupTableInst, lookupTableAddress] =
		AddressLookupTableProgram.createLookupTable({
			authority: user.publicKey,
			payer: user.publicKey,
			recentSlot: slot - 1,
		});
	console.log("lookup table address:", lookupTableAddress.toBase58());

	const extendInstruction = AddressLookupTableProgram.extendLookupTable({
		payer: user.publicKey,
		authority: user.publicKey,
		lookupTable: lookupTableAddress,
		addresses: addresses,
	});

	await sendV0Transaction(connection, user, [
		lookupTableInst,
		extendInstruction,
	]);

	return lookupTableAddress;
}

async function main() {
	// Connect to the devnet cluster
	const connection = new Connection(process.env.RPC_URL!);

	// Generate 30 addresses
	// NOTE max 30
	const recipients = [];
	for (let i = 0; i < 10; i++) {
		recipients.push(Keypair.generate().publicKey);
	}

	console.log(
		"🚀 ~ file: send-batch-sol.ts:132 ~ main ~ recipients:",
		recipients.map((r) => r.toString())
	);

	const lookupTableAddress = await initializeLookupTable(
		payer,
		connection,
		recipients
	);

	console.log(
		"🚀 ~ file: send-batch-sol.ts:150 ~ main ~ lookupTableAddress:",
		lookupTableAddress
	);

	// const lookupTableAddress = new PublicKey(
	// 	"2zurp4SvdcbyEsnmnxwwrfB155tgiMCvBN7x6GFFWuK9"
	// );

	// await waitForNewBlock(connection, 1);

	const lookupTableAccount = (
		await connection.getAddressLookupTable(lookupTableAddress)
	).value;

	// if (!lookupTableAccount) {
	// 	throw new Error("Lookup table not found");
	// }

	const transferInstructions = recipients.map((recipient) => {
		return SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: recipient,
			lamports: 1_000_000, // MIN 0.001 SOL
		});
	});

	// const { transaction, lastValidBlockHeight, blockhash } =
	// 	await getV0Transaction(connection, payer, transferInstructions, [
	// 		lookupTableAccount,
	// 	]);

	// const wallet = Keypair.fromSecretKey(
	// 	bs58.decode(process.env.JITO_AUTH_PRIVATE_KEY!)
	// );
	// const searcherClient = searcher.searcherClient(process.env.BLOCK_ENGINE_URL!);

	// const solAddress = "So11111111111111111111111111111111111111112";
	// const SOLANA_GAS_FEE_PRICE = 0.000005 * LAMPORTS_PER_SOL;

	// const tipAccounts = await searcherClient.getTipAccounts();
	// const tipAccount = new PublicKey(tipAccounts[0]);
	// console.log(
	// 	"🚀 ~ file: send-batch-sol.ts:178 ~ main ~ tipAccount:",
	// 	tipAccount.toString()
	// );

	// let bundle = new Bundle([], 5);

	// let maybeBundle = bundle.addTransactions(transaction);
	// if (isError(maybeBundle)) {
	// 	throw maybeBundle;
	// }

	// maybeBundle = maybeBundle.addTipTx(
	// 	wallet,
	// 	SOLANA_GAS_FEE_PRICE,
	// 	tipAccount,
	// 	blockhash
	// );
	// if (isError(maybeBundle)) {
	// 	throw maybeBundle;
	// }

	// const bundleUuid = await searcherClient.sendBundle(maybeBundle);

	// if (bundleUuid) {
	// 	console.log(
	// 		"🚀 ~ file: send-batch-sol.ts:189 ~ main ~ bundleUuid:",
	// 		bundleUuid
	// 	);
	// } else {
	// 	throw new Error("Bundle UUID not received");
	// }

	// const bundleResult = await onBundleResult(searcherClient);
	// console.log(
	// 	"🚀 ~ file: send-batch-sol.ts:213 ~ main ~ bundleResult:",
	// 	bundleResult
	// );
	// if (bundleResult[0]) {
	// 	console.log("Successful! ");
	// 	process.exit(0);
	// } else {
	// 	console.log("Failed to send Bundle, retrying... (ctrl + c to abort)");
	// 	// console.log('Retries left: ', maxRetries - retries);
	// 	bundleResult[1]();
	// 	// retries += 1;
	// 	// continue
	// }
}

main().catch(console.error);
