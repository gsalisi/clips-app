import arc from "@architect/functions";
import cuid from "cuid";

import type { User } from "./user.server";

export type Size = {
  width: number
  height: number
}

export type Project = {
  id: ReturnType<typeof cuid>;
  userId: User["id"];
  title: string;
  size: Size;
};

type ProjectItem = {
  pk: User["id"];
  sk: `project#${Project["id"]}`;
};

const skToId = (sk: ProjectItem["sk"]): Project["id"] => sk.replace(/^project#/, "");
const idToSk = (id: Project["id"]): ProjectItem["sk"] => `project#${id}`;

export async function getProject({
  id,
  userId,
}: Pick<Project, "id" | "userId">): Promise<Project | null> {
  const db = await arc.tables();

  const result = await db.project.get({ pk: userId, sk: idToSk(id) });

  if (result) {
    return {
      userId: result.pk,
      id: result.sk,
      title: result.title,
      size: result.size,
    };
  }
  return null;
}

export async function getProjectListItems({
  userId,
}: Pick<Project, "userId">): Promise<Array<Pick<Project, "id" | "title">>> {
  const db = await arc.tables();

  const result = await db.project.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": userId },
  });

  return result.Items.map((n: any) => ({
    title: n.title,
    id: skToId(n.sk),
  }));
}

export async function createProject({
  size,
  title,
  userId,
}: Pick<Project, "size" | "title" | "userId">): Promise<Project> {
  const db = await arc.tables();

  const result = await db.project.put({
    pk: userId,
    sk: idToSk(cuid()),
    title: title,
    size: size,
  });
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
  };
}

export async function deleteProject({ id, userId }: Pick<Project, "id" | "userId">) {
  const db = await arc.tables();
  return db.project.delete({ pk: userId, sk: idToSk(id) });
}
