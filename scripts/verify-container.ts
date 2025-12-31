
console.log('Starting container verification...');
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const container = require('../lib/infrastructure/di/container');
    console.log('Container loaded successfully.');
    console.log('User Repo:', !!container.userRepository);
    console.log('Speech Provider:', !!container.speechProvider);
} catch (error) {
    console.error('Container initialization failed:', error);
    process.exit(1);
}
