const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');

function activate(context) {
    console.log('Fileinator is now active!');

    let generateCompleteDataDisposable = vscode.commands.registerCommand('fileinator.generateCompleteData', async (uri) => {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Please right-click a folder!');
            return;
        }

        const folderPath = uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        const excludeDirs = ['node_modules', '__pycache__', '.git', 'build', 'dist'];
        const excludeExts = ['.lock', '.log', '.md'];

        async function getFiles(dir) {
            let results = [];
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        if (!excludeDirs.includes(item.name)) {
                            const subFiles = await getFiles(fullPath);
                            results = results.concat(subFiles);
                        }
                    } else {
                        const ext = path.extname(item.name);
                        if (!excludeExts.includes(ext)) {
                            results.push(fullPath);
                        }
                    }
                }
            } catch (err) {
                console.error(`Error reading directory ${dir}: ${err.message}`);
            }
            return results;
        }

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        vscode.window.showInformationMessage(`Generating complete data for ${relativeFolder}...`);
        const files = await getFiles(folderPath);
        if (files.length === 0) {
            vscode.window.showWarningMessage(`No files found in ${relativeFolder}.`);
            return;
        }

        let outputContent = '';
        for (const file of files) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, file).replace(/\\/g, '/');
            try {
                const content = await fs.readFile(file, 'utf8');
                outputContent += `${relativePath}:\n\ncontents:\n${content.trim()}\n\n`;
            } catch (err) {
                outputContent += `${relativePath}:\n\ncontents:\nError reading file: ${err.message}\n\n`;
            }
        }

        const document = await vscode.workspace.openTextDocument({
            content: outputContent,
            language: 'plaintext',
            uri: vscode.Uri.parse(`untitled:Complete Data - ${relativeFolder}`)
        });
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(`Complete data generated for ${relativeFolder}`);
    });

    let generateFileTreeDisposable = vscode.commands.registerCommand('fileinator.generateFileTree', async (uri) => {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Please right-click a folder!');
            return;
        }

        const folderPath = uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        const excludeDirs = ['node_modules', '__pycache__', '.git', 'build', 'dist'];

        async function buildTree(dir, prefix = '') {
            let tree = '';
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                const filteredItems = items.filter(item => !excludeDirs.includes(item.name));
                for (let i = 0; i < filteredItems.length; i++) {
                    const item = filteredItems[i];
                    const fullPath = path.join(dir, item.name);
                    const isLast = i === filteredItems.length - 1;
                    const connector = isLast ? '└── ' : '├── ';
                    tree += `${prefix}${connector}${item.name}\n`;
                    if (item.isDirectory()) {
                        const newPrefix = prefix + (isLast ? '    ' : '│   ');
                        tree += await buildTree(fullPath, newPrefix);
                    }
                }
            } catch (err) {
                tree += `${prefix}└── Error reading directory: ${err.message}\n`;
            }
            return tree;
        }

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        vscode.window.showInformationMessage(`Generating file tree for ${relativeFolder}...`);
        const treeContent = await buildTree(folderPath);
        if (!treeContent.trim()) {
            vscode.window.showWarningMessage(`No files or folders found in ${relativeFolder}.`);
            return;
        }

        const outputContent = `File Tree for ${relativeFolder}:\n\n${treeContent}`;
        const document = await vscode.workspace.openTextDocument({
            content: outputContent,
            language: 'plaintext',
            uri: vscode.Uri.parse(`untitled:Filetree - ${relativeFolder}`)
        });
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(`File tree generated for ${relativeFolder}`);
    });

    context.subscriptions.push(generateCompleteDataDisposable);
    context.subscriptions.push(generateFileTreeDisposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};