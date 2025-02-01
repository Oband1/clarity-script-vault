import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Can register a new script",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const hash = '0x1234567890123456789012345678901234567890123456789012345678901234';
        
        let block = chain.mineBlock([
            Tx.contractCall('script-vault', 'register-script', [
                types.utf8("Test Script"),
                types.buff(hash),
                types.utf8("Test Description")
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Verify script details
        let getScript = chain.callReadOnlyFn(
            'script-vault',
            'get-script',
            [types.uint(1)],
            deployer.address
        );
        
        const scriptData = getScript.result.expectSome().expectTuple();
        assertEquals(scriptData['owner'], deployer.address);
        assertEquals(scriptData['title'], "Test Script");
        assertEquals(scriptData['current-version'], types.uint(1));
    }
});

Clarinet.test({
    name: "Can update script version with changelog",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const hash1 = '0x1234567890123456789012345678901234567890123456789012345678901234';
        const hash2 = '0x2234567890123456789012345678901234567890123456789012345678901234';
        
        // Register script
        let block = chain.mineBlock([
            Tx.contractCall('script-vault', 'register-script', [
                types.utf8("Test Script"),
                types.buff(hash1),
                types.utf8("Test Description")
            ], deployer.address)
        ]);
        
        // Update script
        block = chain.mineBlock([
            Tx.contractCall('script-vault', 'update-script', [
                types.uint(1),
                types.buff(hash2),
                types.utf8("Added new features")
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(2);
        
        // Verify new version
        let getVersion = chain.callReadOnlyFn(
            'script-vault',
            'get-script-version',
            [types.uint(1), types.uint(2)],
            deployer.address
        );
        
        const versionData = getVersion.result.expectSome().expectTuple();
        assertEquals(versionData['changelog'], "Added new features");
    }
});

Clarinet.test({
    name: "Can manage access rights",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!;
        const hash = '0x1234567890123456789012345678901234567890123456789012345678901234';
        
        // First register a script
        let block = chain.mineBlock([
            Tx.contractCall('script-vault', 'register-script', [
                types.utf8("Test Script"),
                types.buff(hash),
                types.utf8("Test Description")
            ], deployer.address)
        ]);
        
        // Grant access to user1
        block = chain.mineBlock([
            Tx.contractCall('script-vault', 'grant-access', [
                types.uint(1),
                types.principal(user1.address)
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify access
        let checkAccess = chain.callReadOnlyFn(
            'script-vault',
            'can-access',
            [types.uint(1), types.principal(user1.address)],
            deployer.address
        );
        
        assertEquals(checkAccess.result, types.bool(true));
        
        // Revoke access
        block = chain.mineBlock([
            Tx.contractCall('script-vault', 'revoke-access', [
                types.uint(1),
                types.principal(user1.address)
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify access revoked
        checkAccess = chain.callReadOnlyFn(
            'script-vault',
            'can-access',
            [types.uint(1), types.principal(user1.address)],
            deployer.address
        );
        
        assertEquals(checkAccess.result, types.bool(false));
    }
});

Clarinet.test({
    name: "Can transfer ownership",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const newOwner = accounts.get('wallet_1')!;
        const hash = '0x1234567890123456789012345678901234567890123456789012345678901234';
        
        // Register script
        let block = chain.mineBlock([
            Tx.contractCall('script-vault', 'register-script', [
                types.utf8("Test Script"),
                types.buff(hash),
                types.utf8("Test Description")
            ], deployer.address)
        ]);
        
        // Transfer ownership
        block = chain.mineBlock([
            Tx.contractCall('script-vault', 'transfer-ownership', [
                types.uint(1),
                types.principal(newOwner.address)
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify new owner
        let getScript = chain.callReadOnlyFn(
            'script-vault',
            'get-script',
            [types.uint(1)],
            deployer.address
        );
        
        const scriptData = getScript.result.expectSome().expectTuple();
        assertEquals(scriptData['owner'], newOwner.address);
    }
});
