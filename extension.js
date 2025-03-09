const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');

function activate(context) {
    console.log('Fileinator is now active!');

    async function updateIgnoreContext(uri) {
        if (!uri || !uri.fsPath) {
            await vscode.commands.executeCommand('setContext', 'fileinator.isIgnored', false);
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            await vscode.commands.executeCommand('setContext', 'fileinator.isIgnored', false);
            return;
        }

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);
        const isIgnored = ignoredFolders.includes(relativeFolder);
        await vscode.commands.executeCommand('setContext', 'fileinator.isIgnored', isIgnored);
        console.log(`Context updated - relativeFolder: "${relativeFolder}", isIgnored: ${isIgnored}, ignoredFolders: ${JSON.stringify(ignoredFolders)}`);
    }


    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(async () => {
            const uri = vscode.window.activeTextEditor?.document.uri || vscode.window.activeExplorerItem?.resourceUri;
            await updateIgnoreContext(uri);
        }),
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('fileinator.ignoredFolders')) {
                const uri = vscode.window.activeTextEditor?.document.uri || vscode.window.activeExplorerItem?.resourceUri;
                await updateIgnoreContext(uri);
            }
        })
    );

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

        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);
        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        if (ignoredFolders.includes(relativeFolder)) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is ignored by Fileinator.`);
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
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, fullPath).replace(/\\/g, '/');
                    if (item.isDirectory()) {
                        if (!excludeDirs.includes(item.name) && !ignoredFolders.includes(relativePath)) {
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

        vscode.window.showInformationMessage(`Generating complete data for ${relativeFolder}...`);
        const files = await getFiles(folderPath);
        if (files.length === 0) {
            vscode.window.showWarningMessage(`No files found in ${relativeFolder}.`);
            return;
        }

        let outputContent = '';
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relativePath = path.relative(workspaceFolder.uri.fsPath, file).replace(/\\/g, '/');
            try {
                const content = await fs.readFile(file, 'utf8');
                outputContent += `${relativePath}:\n\ncontents:\n${content.trim()}\n\n`;
            } catch (err) {
                outputContent += `${relativePath}:\n\ncontents:\nError reading file: ${err.message}\n\n`;
            }
            if (i < files.length - 1) {
                outputContent += '============================\n\n';
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

        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);
        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        if (ignoredFolders.includes(relativeFolder)) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is ignored by Fileinator.`);
            return;
        }

        const excludeDirs = ['node_modules', '__pycache__', '.git', 'build', 'dist'];

        async function buildTree(dir, prefix = '') {
            let tree = '';
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                const filteredItems = items.filter(item => 
                    !excludeDirs.includes(item.name) && 
                    !ignoredFolders.includes(path.relative(workspaceFolder.uri.fsPath, path.join(dir, item.name)).replace(/\\/g, '/'))
                );
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

    let ignoreFromGenerationsDisposable = vscode.commands.registerCommand('fileinator.ignoreFromGenerations', async (uri) => {
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

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);

        if (ignoredFolders.includes(relativeFolder)) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is already ignored.`);
            return;
        }

        ignoredFolders.push(relativeFolder);
        await config.update('ignoredFolders', ignoredFolders, vscode.ConfigurationTarget.Workspace);
        await updateIgnoreContext(uri);
        vscode.window.showInformationMessage(`Folder "${relativeFolder}" added to Fileinator ignore list`);
    });

    let includeInGenerationsDisposable = vscode.commands.registerCommand('fileinator.includeInGenerations', async (uri) => {
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

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        const config = vscode.workspace.getConfiguration('fileinator');
        let ignoredFolders = config.get('ignoredFolders', []);

        if (!ignoredFolders.includes(relativeFolder)) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is not ignored.`);
            return;
        }

        ignoredFolders = ignoredFolders.filter(folder => folder !== relativeFolder);
        await config.update('ignoredFolders', ignoredFolders, vscode.ConfigurationTarget.Workspace);
        await updateIgnoreContext(uri);
        vscode.window.showInformationMessage(`Folder "${relativeFolder}" removed from Fileinator ignore list`);
    });

    context.subscriptions.push(generateCompleteDataDisposable);
    context.subscriptions.push(generateFileTreeDisposable);
    context.subscriptions.push(ignoreFromGenerationsDisposable);
    context.subscriptions.push(includeInGenerationsDisposable);


    const initialUri = vscode.window.activeTextEditor?.document.uri || vscode.window.activeExplorerItem?.resourceUri;
    if (initialUri) updateIgnoreContext(initialUri);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};