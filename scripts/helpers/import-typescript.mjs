import fs from "node:fs";
import ts from "typescript";

export async function importTypeScript(url) {
	const source = fs.readFileSync(url, "utf8");
	const { outputText, diagnostics } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		reportDiagnostics: true,
		fileName: url.pathname,
	});

	const errors = diagnostics?.filter(
		(diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
	);
	if (errors?.length) {
		throw new Error(
			errors
				.map((diagnostic) =>
					ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
				)
				.join("\n"),
		);
	}

	return import(
		`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
	);
}
