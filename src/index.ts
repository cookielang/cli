import {
    Lexer,
    TokenStream,
    Parser,
    CCodeGenPass,
    NodeType,
    Function
} from "libcookielang";
import { readFile, writeFile, unlink } from "mz/fs";
import { exec } from "mz/child_process";
function panic(msg: string) {
    console.error(msg);
    process.exit(1);
}
async function run() {
    if (process.argv.length !== 3) return panic("USAGE: cookielang <FILE>");
    const fn = process.argv[process.argv.length - 1];
    const content = (await readFile(fn)).toString();
    const tokens = new Lexer(content, true).lex();
    const ts = new TokenStream(tokens);
    const parser = new Parser(ts);
    const nodes = [];
    while (parser.ts.hasNext()) {
        nodes.push(parser.parseTopLevel());
    }
    const codegen = new CCodeGenPass();
    const output = nodes
        .filter((node) => node.type == NodeType.FUNCTION)
        .map((node) => {
            codegen.visitFunction(<Function>node);
            return codegen.valueStack.pop();
        })
        .join("\n");
    await writeFile(fn + ".tmp.c", output);
    try {
        await exec(
            `gcc -Wall -Wextra -Werror -O2 -std=c99 -pedantic -o ${fn} ${fn}.tmp.c`
        );
    } catch (err) {
        panic(err.toString());
    }
    await unlink(fn + ".tmp.c");
}
run().catch((err) => panic(err));
