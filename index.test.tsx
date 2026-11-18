import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { z } from "zod";
import { useLocalStorage, useLocalStorageJson } from "./index.tsx";

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanup();
});

describe("useLocalStorage", () => {
    test("reads an existing string value", () => {
        localStorage.setItem("name", "alice");
        const schema = z.string();
        const { result } = renderHook(() => useLocalStorage("name", schema));

        expect(result.current[0]).toBe("alice");
    });

    test("returns undefined when the key is missing", () => {
        const schema = z.string();
        const { result } = renderHook(() => useLocalStorage("missing", schema));

        expect(result.current[0]).toBeUndefined();
    });

    test("returns undefined when the stored value fails the schema", () => {
        localStorage.setItem("color", "purple");
        const schema = z.enum(["red", "green", "blue"]);
        const { result } = renderHook(() => useLocalStorage("color", schema));

        expect(result.current[0]).toBeUndefined();
    });

    test("decodes values with a codec schema", () => {
        localStorage.setItem("count", "42");
        const schema = z.codec(z.string(), z.number(), {
            decode: (s) => Number(s),
            encode: (n) => String(n),
        });
        const { result } = renderHook(() => useLocalStorage("count", schema));

        expect(result.current[0]).toBe(42);
    });

    test("setter updates both state and localStorage", () => {
        const schema = z.string();
        const { result } = renderHook(() => useLocalStorage("name", schema));

        act(() => result.current[1]("bob"));

        expect(result.current[0]).toBe("bob");
        expect(localStorage.getItem("name")).toBe("bob");
    });

    test("setter encodes values through a codec schema", () => {
        const schema = z.codec(z.string(), z.number(), {
            decode: (s) => Number(s),
            encode: (n) => String(n),
        });
        const { result } = renderHook(() => useLocalStorage("count", schema));

        act(() => result.current[1](7));

        expect(result.current[0]).toBe(7);
        expect(localStorage.getItem("count")).toBe("7");
    });

    test("setter throws and leaves state untouched for invalid values", () => {
        localStorage.setItem("color", "red");
        const schema = z.enum(["red", "green", "blue"]);
        const { result } = renderHook(() => useLocalStorage("color", schema));

        expect(() =>
            act(() => result.current[1]("purple" as any))
        ).toThrow();
        expect(result.current[0]).toBe("red");
        expect(localStorage.getItem("color")).toBe("red");
    });

    test("value persists across remounts", () => {
        const schema = z.string();
        const first = renderHook(() => useLocalStorage("name", schema));
        act(() => first.result.current[1]("persisted"));
        first.unmount();

        const second = renderHook(() => useLocalStorage("name", schema));
        expect(second.result.current[0]).toBe("persisted");
    });

    test("setting undefined removes the item and clears state", () => {
        localStorage.setItem("name", "alice");
        const schema = z.string();
        const { result } = renderHook(() => useLocalStorage("name", schema));
        expect(result.current[0]).toBe("alice");

        act(() => result.current[1](undefined));

        expect(result.current[0]).toBeUndefined();
        expect(localStorage.getItem("name")).toBeNull();
    });

    test("deleted value stays deleted after a remount", () => {
        localStorage.setItem("name", "alice");
        const schema = z.string();
        const first = renderHook(() => useLocalStorage("name", schema));
        act(() => first.result.current[1](undefined));
        first.unmount();

        const second = renderHook(() => useLocalStorage("name", schema));
        expect(second.result.current[0]).toBeUndefined();
    });

    test("setting undefined on a missing key is a no-op", () => {
        localStorage.setItem("other", "untouched");
        const schema = z.string();
        const { result } = renderHook(() => useLocalStorage("missing", schema));

        act(() => result.current[1](undefined));

        expect(result.current[0]).toBeUndefined();
        expect(localStorage.getItem("missing")).toBeNull();
        expect(localStorage.getItem("other")).toBe("untouched");
    });

    test("setter identity is stable across renders when schema is stable", () => {
        const schema = z.string();
        const { result, rerender } = renderHook(() => useLocalStorage("name", schema));
        const firstSetter = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstSetter);
    });

    test("without a schema, reads the raw string", () => {
        localStorage.setItem("raw", "hello");
        const { result } = renderHook(() => useLocalStorage("raw"));

        expect(result.current[0]).toBe("hello");
    });

    // --- Regression tests for previously fixed bugs ---

    test("without a schema, a missing key returns undefined (not null)", () => {
        const { result } = renderHook(() => useLocalStorage("missing"));

        expect(result.current[0]).toBeUndefined();
    });

    test("without a schema, setter identity is stable across renders", () => {
        const { result, rerender } = renderHook(() => useLocalStorage("raw"));
        const firstSetter = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstSetter);
    });

    test("re-reads localStorage when the key changes", () => {
        localStorage.setItem("a", "value-a");
        localStorage.setItem("b", "value-b");
        const schema = z.string();
        const { result, rerender } = renderHook(
            ({ name }) => useLocalStorage(name, schema),
            { initialProps: { name: "a" } }
        );
        expect(result.current[0]).toBe("value-a");

        rerender({ name: "b" });

        expect(result.current[0]).toBe("value-b");
    });
});

describe("useLocalStorageJson", () => {
    const User = z.object({ name: z.string(), age: z.number() });

    test("parses a stored JSON object", () => {
        localStorage.setItem("user", JSON.stringify({ name: "alice", age: 25 }));
        const { result } = renderHook(() => useLocalStorageJson("user", User));

        expect(result.current[0]).toEqual({ name: "alice", age: 25 });
    });

    test("returns undefined for invalid JSON", () => {
        localStorage.setItem("user", "{not json");
        const { result } = renderHook(() => useLocalStorageJson("user", User));

        expect(result.current[0]).toBeUndefined();
    });

    test("returns undefined when JSON doesn't match the schema", () => {
        localStorage.setItem("user", JSON.stringify({ name: "alice", age: "old" }));
        const { result } = renderHook(() => useLocalStorageJson("user", User));

        expect(result.current[0]).toBeUndefined();
    });

    test("returns undefined when the key is missing", () => {
        const { result } = renderHook(() => useLocalStorageJson("user", User));

        expect(result.current[0]).toBeUndefined();
    });

    test("setter writes JSON to localStorage and updates state", () => {
        const { result } = renderHook(() => useLocalStorageJson("user", User));

        act(() => result.current[1]({ name: "bob", age: 3 }));

        expect(result.current[0]).toEqual({ name: "bob", age: 3 });
        expect(JSON.parse(localStorage.getItem("user")!)).toEqual({ name: "bob", age: 3 });
    });

    test("handles JSON arrays", () => {
        localStorage.setItem("flags", "[true,false]");
        const schema = z.array(z.boolean());
        const { result } = renderHook(() => useLocalStorageJson("flags", schema));

        expect(result.current[0]).toEqual([true, false]);
    });

    test("round-trips through a remount", () => {
        const first = renderHook(() => useLocalStorageJson("user", User));
        act(() => first.result.current[1]({ name: "alice", age: 25 }));
        first.unmount();

        const second = renderHook(() => useLocalStorageJson("user", User));
        expect(second.result.current[0]).toEqual({ name: "alice", age: 25 });
    });

    test("setting undefined removes the item instead of storing JSON", () => {
        localStorage.setItem("user", JSON.stringify({ name: "alice", age: 25 }));
        const { result } = renderHook(() => useLocalStorageJson("user", User));
        expect(result.current[0]).toEqual({ name: "alice", age: 25 });

        act(() => result.current[1](undefined));

        expect(result.current[0]).toBeUndefined();
        expect(localStorage.getItem("user")).toBeNull();
    });

    // --- Regression tests for previously fixed bugs ---

    test("without a schema, still parses JSON", () => {
        localStorage.setItem("data", JSON.stringify({ a: 1 }));
        const { result } = renderHook(() => useLocalStorageJson("data"));

        expect(result.current[0]).toEqual({ a: 1 });
    });

    test("without a schema, setter writes JSON", () => {
        const { result } = renderHook(() => useLocalStorageJson("data"));

        act(() => result.current[1]({ a: 1 }));

        expect(localStorage.getItem("data")).toBe('{"a":1}');
    });
});
