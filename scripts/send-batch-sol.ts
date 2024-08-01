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
} from "@solana/web3.js";
import { config } from "dotenv";
config();

const payer = Keypair.fromSecretKey(
	Uint8Array.from(process.env.PRIV_KEY.split(",").map((e) => +e))
);

async function sendV0Transaction(
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
	const connection = new Connection(clusterApiUrl("devnet"));

	// Generate 30 addresses
	// NOTE max 30
	const recipients = [];
	for (let i = 0; i < 30; i++) {
		recipients.push(Keypair.generate().publicKey);
	}

	const lookupTableAddress = await initializeLookupTable(
		payer,
		connection,
		recipients
	);

	await waitForNewBlock(connection, 1);

	const lookupTableAccount = (
		await connection.getAddressLookupTable(lookupTableAddress)
	).value;

	if (!lookupTableAccount) {
		throw new Error("Lookup table not found");
	}

	const transferInstructions = recipients.map((recipient) => {
		return SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: recipient,
			lamports: 1_000_000, // MIN 0.001 SOL
		});
	});

	await sendV0Transaction(connection, payer, transferInstructions, [
		lookupTableAccount,
	]);
}

main().catch(console.error);
