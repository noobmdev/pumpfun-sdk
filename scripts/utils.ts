import {
	AddressLookupTableAccount,
	Connection,
	Keypair,
	PublicKey,
	SystemProgram,
	TransactionInstruction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";

const MEMO_PROGRAM_ID = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";

export const sendBundles = async (
	c: SearcherClient,
	bundleTransactionLimit: number,
	keypair: Keypair,
	conn: Connection
) => {
	const _tipAccount = (await c.getTipAccounts())[0];
	console.log("tip account:", _tipAccount);
	const tipAccount = new PublicKey(_tipAccount);

	const balance = await conn.getBalance(keypair.publicKey);
	console.log("current account has balance: ", balance);

	let isLeaderSlot = false;
	while (!isLeaderSlot) {
		const next_leader = await c.getNextScheduledLeader();
		const num_slots = next_leader.nextLeaderSlot - next_leader.currentSlot;
		isLeaderSlot = num_slots <= 2;
		console.log(`next jito leader slot in ${num_slots} slots`);
		await new Promise((r) => setTimeout(r, 500));
	}

	const blockHash = await conn.getLatestBlockhash();
	const b = new Bundle([], bundleTransactionLimit);

	const recipients1 = [
		new PublicKey("A9yYYUDxhnjgPQMmuNoQx3kK7FnipXLWYVWJsESHwbx3"),
		new PublicKey("8gvWcVWSaosUccxJiy6VfYMJbk1ZsCS8aC5BUt5MZyVG"),
		new PublicKey("F3h8VfXjrsqJFDrBwZfqYFHLYpsM6FHA1WbVGLeVWVx"),
		new PublicKey("CupfuWP75Lc4qzqN9Kd4HZ7RPFyytwQP9xmL9RRiNxS6"),
		new PublicKey("FrgnfFfUGG4eEi94H3GHUfUeGvf52fVsLD3ShfiWAxUC"),
		new PublicKey("DyZNZKZLvjq9wFu4MLRFAT4bH3vxifQQkwNpn7NjW8C"),
		new PublicKey("BaXea8xoLzyLR1q6GvSokjuthJETpbASxiwFkKGPYTan"),
		new PublicKey("8nTJMFU611KATLf5TPf6KB3fQRxj4szttN2vr5JEFWLi"),
		new PublicKey("4uDhzmBNzRkXtNKwSVPbekcwfH5aT65cVzG76BzqewJa"),
		new PublicKey("85f6mHzTbd114112LLtRsPeV2AKewPHLjt2LnKgsFEgh"),
	];

	const recipients2 = [
		new PublicKey("cp4uKN9zCKHv18pS6ivEudinVy2mEwNoDhuBF7tpqtG"),
		new PublicKey("8u3jHpwgE3oyGj1D4ujKRi4wLLHQkHT69WVAG3KtP5cV"),
		new PublicKey("AHTpVs1ypA4rYWxtREx4LhJaSqnpaKYXW8ekuRRutatM"),
		new PublicKey("BEd7JCn7yj4Hsmno483F9YshXrnhSo2vYVGSKsVSn6Pb"),
		new PublicKey("7ALo93T98M9TEbUetZRQHBmLC2vyG9VG1qT7EtEGsaMz"),
		new PublicKey("5Lee7MqptXGKssUzB2MqkzWhc48ikNNALej1MaGNTBa1"),
		new PublicKey("GvhfTL7QLSJs8k6kqmMyJqySkHg3g3xPYXGAshifBGkp"),
		new PublicKey("4BZYtsP7YAwZQ5YZ5kCeZm9n5Bobv4AF9Nj9sATKPmcT"),
		new PublicKey("3odbiGASn3GESoAjkjiogF2PYga2Yb3ttEFTf7Jz7Ew9"),
		new PublicKey("5URMnaRDsfJ8YhZ8p9yhdarCFETYE43EzMboqVg1K3RZ"),
	];

	const lookupTableAccount1 = (
		await conn.getAddressLookupTable(
			new PublicKey("E3Ti5acEXrUxw7bpBA2UGzLeKZm33GBYKK8Cv5PLvfpm")
		)
	).value;

	const lookupTableAccount2 = (
		await conn.getAddressLookupTable(
			new PublicKey("Bd9ZYbBmJSd5uPHpXwNUKdE69LMWaHbuinjni2PyGD5F")
		)
	).value;

	if (!lookupTableAccount1 || !lookupTableAccount2) {
		throw new Error("No lookup table");
	}

	const bundles = [b];

	let maybeBundle = b.addTransactions(
		buildSendSol(keypair, blockHash.blockhash, recipients1, [
			lookupTableAccount1,
		]),
		buildSendSol(keypair, blockHash.blockhash, recipients2, [
			lookupTableAccount2,
		])
	);
	if (isError(maybeBundle)) {
		throw maybeBundle;
	}

	maybeBundle = maybeBundle.addTipTx(
		keypair,
		200_000,
		tipAccount,
		blockHash.blockhash
	);

	if (isError(maybeBundle)) {
		throw maybeBundle;
	}

	bundles.map(async (b) => {
		try {
			const resp = await c.sendBundle(b);
			console.log("resp:", resp);
		} catch (e) {
			console.error("error sending bundle:", e);
		}
	});
};

export const onBundleResult = (c: SearcherClient) => {
	c.onBundleResult(
		(result) => {
			console.log("received bundle result:", result);
		},
		(e) => {
			throw e;
		}
	);
};

const buildSendSol = (
	keypair: Keypair,
	recentBlockhash: string,
	recipients: PublicKey[],
	lookupTableAccounts: AddressLookupTableAccount[]
): VersionedTransaction => {
	const transferInstructions = recipients.map((recipient) => {
		return SystemProgram.transfer({
			fromPubkey: keypair.publicKey,
			toPubkey: recipient,
			lamports: 1_000_000, // MIN 0.001 SOL
		});
	});

	// const { transaction, lastValidBlockHeight, blockhash } =
	// 	await getV0Transaction(connection, payer, transferInstructions, [
	// 		lookupTableAccount,
	// 	]);

	const messageV0 = new TransactionMessage({
		payerKey: keypair.publicKey,
		recentBlockhash: recentBlockhash,
		instructions: transferInstructions,
	}).compileToV0Message(lookupTableAccounts);

	const tx = new VersionedTransaction(messageV0);

	tx.sign([keypair]);

	console.log("txn signature is: ", bs58.encode(tx.signatures[0]));
	return tx;
};

const buildMemoTransaction = (
	keypair: Keypair,
	message: string,
	recentBlockhash: string
): VersionedTransaction => {
	const ix = SystemProgram.transfer({
		fromPubkey: keypair.publicKey,
		toPubkey: Keypair.generate().publicKey,
		lamports: 1_000_000, // MIN 0.001 SOL
	});

	// const ix = new TransactionInstruction({
	// 	keys: [
	// 		{
	// 			pubkey: keypair.publicKey,
	// 			isSigner: true,
	// 			isWritable: true,
	// 		},
	// 	],
	// 	programId: new PublicKey(MEMO_PROGRAM_ID),
	// 	data: Buffer.from(message),
	// });

	const instructions = [ix];

	const messageV0 = new TransactionMessage({
		payerKey: keypair.publicKey,
		recentBlockhash: recentBlockhash,
		instructions,
	}).compileToV0Message();

	const tx = new VersionedTransaction(messageV0);

	tx.sign([keypair]);

	console.log("txn signature is: ", bs58.encode(tx.signatures[0]));
	return tx;
};
