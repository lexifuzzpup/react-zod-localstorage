import { useCallback, useEffect, useMemo, useState } from "react";
import { z, ZodAny, type ZodType } from "zod";

export type LocalStorageHook<Schema> = [
    z.infer<Schema> | undefined,
    (value: z.infer<Schema>) => void
]

/**
 * Parses a localStorage value using a zod schema, returning undefined
 * if it doesn't match. Must accept a string input, which can be coerced
 * into a usable value. If you want a custom type, define a JSON codec or
 * use the useLocalStorageJson hook.
 * @param name Key in localStorage
 * @param schema Zod schema that parses a string into a usable value
 * @returns [ value, setValue ]
 */
export function useLocalStorage<Schema extends ZodType<any, string> = ZodAny>(
    name: string,
    schema?: Schema
): LocalStorageHook<Schema> {
    schema = useMemo<Schema>(() => schema ?? z.any() as any, [ schema ]);

    const localStorageItem = useMemo(() => {
        return schema.safeParse(localStorage.getItem(name) ?? undefined)
    }, [ schema, name ]);

    const [ item, setItem ] = useState();
    useEffect(() => setItem(localStorageItem.data), [ schema, name ]);

    return [
        item,
        useCallback((value: z.infer<Schema>) => {
            localStorage.setItem(name, schema.encode(value));
            setItem(value);
        }, [ name, schema ])
    ]
}

// https://zod.dev/codecs?id=jsonschema#jsonschema
const jsonCodec = <T extends z.core.$ZodType>(schema: T) =>
    z.codec(z.string(), schema, {
        decode: (jsonString, ctx) => {
            try {
                return JSON.parse(jsonString);
            } catch (err: any) {
                ctx.issues.push({
                    code: "invalid_format",
                    format: "json",
                    input: jsonString,
                    message: err.message,
                });
                return z.NEVER;
            }
        },
        encode: (value) => JSON.stringify(value),
    });

/**
 * Parses a localStorage value using a zod schema, returning undefined
 * if it doesn't match. Uses an internal JSON codec for reading/writing
 * values to localStorage.
 * @param name Key in localStorage
 * @param schema Zod schema for a custom type
 * @returns [ value, setValue ]
 */
export function useLocalStorageJson<Schema extends ZodType>(
    name: string,
    schema?: Schema
): LocalStorageHook<Schema> {
    const jsonCodecSchema = useMemo(() => jsonCodec(schema ?? z.any()), [ schema ]);
    
    return useLocalStorage(name, jsonCodecSchema);
}