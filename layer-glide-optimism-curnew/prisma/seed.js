import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Add test operators
    const operators = [
        { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
        { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
        { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' }
    ];

    for (const operator of operators) {
        await prisma.operator.upsert({
            where: { address: operator.address },
            update: {},
            create: operator
        });
    }

    console.log('Database seeded!');
    console.log('Added operators:', operators.length);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 