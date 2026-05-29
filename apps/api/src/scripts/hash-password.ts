import bcrypt from "bcryptjs";

const password = process.argv[2] ?? "NexusDemo2024!";
const hash = bcrypt.hashSync(password, 12);
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
