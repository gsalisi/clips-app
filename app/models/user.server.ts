import arc from "@architect/functions";
import bcrypt from "bcryptjs";
import invariant from "tiny-invariant";
import getUuidByString from "uuid-by-string";

const INITIAL_CREDITS_AMOUNT = 10

export type User = { 
  id: string; email: string;
  picture: string;
  provider: string;
  providerID: string;
  name: string; 
  credits: number;
};
export type Password = { password: string };

async function checkAllowlist(email: string): Promise<boolean> {
  const db = await arc.tables();
  const allowlist_user = await db.user_allowlist.get({ email: email })
  return !!allowlist_user
}

export async function getUserById(id: User["id"]): Promise<Pick<User, "id" | "email" | "credits"> | null> {
  const db = await arc.tables();
  const result = await db.user.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": id },
  });

  const [record] = result.Items;
  if (record) return { id: record.pk, email: record.email, credits: record.credits };
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

export async function findOrCreate({
  email,
  picture,
  provider,
  providerID,
  name,
}: Pick<User, "email" | "picture" | "provider" | "providerID" | "name">) {
  const cleanEmail = dePlussedEmail(email)
  const user = await getUserByEmail(cleanEmail)
  if (user) {
    return user
  }

  // if (process.env.ARC_ENV !== "testing") {
    // const allowlisted = await checkAllowlist(cleanEmail)
    // if(!allowlisted) {
    //   throw Error("This email is not allowlisted.")
    // }
  // }
  
  const userId = getUuidByString(cleanEmail)
  const db = await arc.tables();
  await db.user.put({
    pk: userId,
    email,
    picture,
    provider,
    providerID,
    name,
    credits: INITIAL_CREDITS_AMOUNT,
  });

  const newUser = await getUserByEmail(cleanEmail);
  invariant(newUser, `User not found after being created. This should not happen`);

  return newUser;
}

export async function createUser(
  email: User["email"],
  password: Password["password"]
) {
  const cleanEmail = dePlussedEmail(email)
  // if (process.env.ARC_ENV !== "testing") {
  //   const allowlisted = await checkAllowlist(cleanEmail)
  //   if(!allowlisted) {
  //     throw Error("This email is not allowlisted.")
  //   }
  // }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = getUuidByString(cleanEmail)
  const db = await arc.tables();
  await db.password.put({
    pk: userId,
    password: hashedPassword,
  });

  await db.user.put({
    pk: userId,
    email,
    credits: 10,
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

export async function checkCredits(
  id: User["id"]
) {
  const user = await getUserById(id)
  if (!user) {
    return 0
  }
  return user.credits
}
