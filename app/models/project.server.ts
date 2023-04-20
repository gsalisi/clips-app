import arc from "@architect/functions";
import cuid from "cuid";
import invariant from "tiny-invariant";

import type { User } from "./user.server";

export type Size = {
  width: number
  height: number
}

export type S3Location = {
  bucket: string
  key: string
}

export type SingleCropAttributes = {
  size: Size,
  excludeLimbs: boolean,
  paddingRatio: number,
  smoothingWindowSecs: number,
}

export type MultiCropAttributes = SingleCropAttributes & {
  trackIds: string[],
  trackLocation: S3Location,
  trackPreviewDir: S3Location,
}

export type EffectMetadata = {
  type: "single_crop" | "multi_crop"
  attributes: SingleCropAttributes | MultiCropAttributes
}

export enum ProjectState {
  Started = "Started",
  Processing = "Processing",
  Completed = "Completed",
}

export type Project = {
  id: ReturnType<typeof cuid>;
  userId: User["id"];
  title: string;
  size: Size;
  state: ProjectState,
  inputFile?: S3Location,
  outputFile?: S3Location,
  effectMetadata?: EffectMetadata,
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
      id: skToId(result.sk),
      title: result.title,
      size: result.size,
      state: result.state,
      inputFile: result.inputFile,
      outputFile: result.outputFile,
      effectMetadata: result.effectMetadata,
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

  console.log({
    pk: userId,
    sk: idToSk(cuid()),
    title: title,
    size: size,
  })
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
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    effectMetadata: result.effectMetadata,
  };
}

export async function updateProject({
  id,
  userId,
  inputFile,
  outputFile,
  effectMetadata,
}: Pick<Project, "id" | "userId" | "inputFile" | "outputFile" | "effectMetadata">): Promise<Project> {
  const db = await arc.tables();
  const existingProj = await db.project.get({ pk: userId, sk: idToSk(id) });
  
  if (!existingProj) {
    throw Error(`Project ${id} does not exist.`)
  }

  const result = await db.project.put({
    ...existingProj,
    inputFile: inputFile ?? existingProj.inputFile,
    outputFile: outputFile ?? existingProj.outputFile,
    effectMetadata: effectMetadata ?? existingProj.effectMetadata,
  });
  
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    effectMetadata: result.effectMetadata,
  };
}

export async function deleteProject({ id, userId }: Pick<Project, "id" | "userId">) {
  const db = await arc.tables();
  return db.project.delete({ pk: userId, sk: idToSk(id) });
}
