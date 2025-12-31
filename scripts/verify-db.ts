
import postgres from 'postgres';

async function testConnection() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ DATABASE_URL is missing');
        process.exit(1);
    }

    console.log(`Testing connection to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

    const sql = postgres(connectionString, {
        ssl: connectionString.includes('supabase') ? 'require' : undefined,
        max: 1,
        idle_timeout: 5,
        prepare: false, // Intentionally disabled as per fix
    });

    try {
        console.log('1. Testing simple SELECT 1...');
        const result = await sql`SELECT 1 as "ok"`;
        console.log('✅ Connected successfully:', result);

        console.log('2. Testing Jobs table access...');
        try {
            const jobs = await sql`SELECT count(*) FROM jobs`;
            console.log('✅ Jobs table accessible:', jobs);
        } catch (tableErr) {
            console.error('❌ Jobs table query failed:', tableErr);
        }

    } catch (err) {
        console.error('❌ Connection failed:', err);

        // Attempt Fallback: Direct Connection (Session Mode)
        // From: postgres://[user].[project]:[pass]@[pooler]:6543/...
        // To:   postgres://postgres:[pass]@db.[project].supabase.co:5432/postgres
        if (connectionString.includes('pooler.supabase.com')) {
            console.log('\n--- Attempting Fallback: Direct Connection (Session Mode) ---');
            try {
                const url = new URL(connectionString);
                // Extract project ID from username (postgres.[project_id])
                const usernameParts = url.username.split('.');
                const projectId = usernameParts.length > 1 ? usernameParts[1] : null;

                if (projectId) {
                    // Construct direct URL
                    url.hostname = `db.${projectId}.supabase.co`;
                    url.port = '5432';
                    url.username = 'postgres'; // Direct connection usually uses 'postgres'
                    url.searchParams.delete('pgbouncer');

                    console.log(`Testing direct connection to: ${url.toString().replace(/:[^:@]+@/, ':***@')}`);

                    const sqlDirect = postgres(url.toString(), {
                        ssl: 'require',
                        max: 1,
                        idle_timeout: 5,
                    });

                    const result = await sqlDirect`SELECT 1 as "ok"`;
                    console.log('✅ Direct connection successful!', result);
                    console.log('💡 RECOMMENDATION: The Connection Pooler seems down or misconfigured. Switch to the Direct Connection URL above.');
                    await sqlDirect.end();
                } else {
                    console.log('⚠️ Could not extract project ID to attempt direct connection.');
                }
            } catch (fallbackErr) {
                console.error('❌ Direct connection also failed:', fallbackErr);
            }
        }
    } finally {
        await sql.end();
    }
}

testConnection();
