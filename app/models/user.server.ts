import arc from "@architect/functions";
import bcrypt from "bcryptjs";
import invariant from "tiny-invariant";
import getUuidByString from "uuid-by-string";

export type User = { id: string; email: string };
export type Password = { password: string };

export async function getUserById(id: User["id"]): Promise<User | null> {
  const db = await arc.tables();
  const result = await db.user.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": id },
  });

  const [record] = result.Items;
  if (record) return { id: record.pk, email: record.email };
  return null;
}

export async function getUserByEmail(email: User["email"]) {
  return getUserById(getUuidByString(email));
}

async function getUserPasswordByEmail(email: User["email"]) {
  const db = await arc.tables();
  const result = await db.password.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": getUuidByString(email) },
  });

  const [record] = result.Items;

  if (record) return { hash: record.password };
  return null;
}

const dePlussedEmail = (email: string): string => email.split('@')[0].split('+')[0] + '@' + email.split('@')[1];

export async function createUser(
  email: User["email"],
  password: Password["password"]
) {
  const cleanEmail = dePlussedEmail(email)
  const hashedPassword = await bcrypt.hash(password, 10);
  const db = await arc.tables();
  const userId = getUuidByString(cleanEmail)
  await db.password.put({
    pk: userId,
    password: hashedPassword,
  });

  await db.user.put({
    pk: userId,
    email,
  });

  const user = await getUserByEmail(cleanEmail);
  invariant(user, `User not found after being created. This should not happen`);

  return user;
}

export async function deleteUser(email: User["email"]) {
  const db = await arc.tables();
  const userId = getUuidByString(email)
  await db.password.delete({ pk: userId });
  await db.user.delete({ pk: userId });
}

export async function verifyLogin(
  email: User["email"],
  password: Password["password"]
) {
  const userPassword = await getUserPasswordByEmail(email);

  if (!userPassword) {
    return undefined;
  }

  const isValid = await bcrypt.compare(password, userPassword.hash);
  if (!isValid) {
    return undefined;
  }

  return getUserByEmail(email);
}
