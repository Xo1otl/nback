/**
 * Storage package contract tests: the Store suite run against the in-memory
 * mock, plus direct checks of the KeyValue mock (the backing the real
 * localStorage-based store will be constructed over in step 4).
 */

import { describe, expect, test } from "bun:test";
import { newMemoryKeyValue, newMemoryStore } from "./_mock";
import { runStoreContractSuite } from "./_suite";

runStoreContractSuite("memory store", newMemoryStore);

describe("newMemoryKeyValue", () => {
	test("getItem on a missing key returns null", () => {
		const kv = newMemoryKeyValue();
		expect(kv.getItem("absent")).toBeNull();
	});

	test("setItem then getItem returns the stored string", () => {
		const kv = newMemoryKeyValue();
		kv.setItem("settings", '{"n":2}');
		expect(kv.getItem("settings")).toBe('{"n":2}');
	});

	test("setItem overwrites the previous value for a key", () => {
		const kv = newMemoryKeyValue();
		kv.setItem("k", "first");
		kv.setItem("k", "second");
		expect(kv.getItem("k")).toBe("second");
	});

	test("removeItem deletes the key", () => {
		const kv = newMemoryKeyValue();
		kv.setItem("k", "v");
		kv.removeItem("k");
		expect(kv.getItem("k")).toBeNull();
	});

	test("removeItem on a missing key is a no-op", () => {
		const kv = newMemoryKeyValue();
		expect(() => {
			kv.removeItem("absent");
		}).not.toThrow();
		expect(kv.getItem("absent")).toBeNull();
	});

	test("dump reflects the raw stored strings", () => {
		const kv = newMemoryKeyValue();
		kv.setItem("a", "1");
		kv.setItem("b", '{"x":true}');
		kv.removeItem("a");
		const dump = kv.dump();
		expect(dump.size).toBe(1);
		expect(dump.get("b")).toBe('{"x":true}');
		expect(dump.has("a")).toBe(false);
	});
});
