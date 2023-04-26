import arc from "@architect/functions";
import cuid from "cuid";

import type { User } from "./user.server";

export type Size = {
  width: number
  height: number
}

export type S3Location = {
  bucket: string
  key: string
}

export type TrackHint = {
  timeSecs: number
  normLtwh: [number, number, number, number]
}

export type CropTrackerOpts = {
  excludeLimbs: boolean,
  paddingRatio: number,
  smoothingWindowSecs: number,
  trackHints?: TrackHint[],
}

export enum ProjectState {
  Created,
  Ready,
  Processing,
  Completed,
}

export type Project = {
  id: ReturnType<typeof cuid>;
  userId: User["id"];
  title: string;
  size: Size;
  state: ProjectState,
  inputFile?: S3Location,
  outputFile?: S3Location,
  cropTrackerOpts?: CropTrackerOpts,
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
      cropTrackerOpts: result.cropTrackerOpts,
    };
  }
  return null;
}

export async function getProjectListItems({
  userId,
}: Pick<Project, "userId">): Promise<Array<Pick<Project, "id" | "title" | "state">>> {
  const db = await arc.tables();

  const result = await db.project.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": userId },
  });

  return result.Items.map((n: any) => ({
    title: n.title,
    state: n.state,
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
    state: ProjectState.Created,
  });
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    cropTrackerOpts: result.cropTrackerOpts,
  };
}

export async function updateProject({
  id,
  userId,
  inputFile,
  outputFile,
}: Pick<Project, "id" | "userId" | "inputFile" | "outputFile">): Promise<Project> {
  const db = await arc.tables();
  const existingProj = await db.project.get({ pk: userId, sk: idToSk(id) });
  
  if (!existingProj) {
    throw Error(`Project ${id} does not exist.`)
  }

  const result = await db.project.put({
    ...existingProj,
    inputFile: inputFile ?? existingProj.inputFile,
    outputFile: outputFile ?? existingProj.outputFile,
    cropTrackerOpts: existingProj.cropTrackerOpts
  });
  
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    cropTrackerOpts: result.cropTrackerOpts,
  };
}

export async function updateCropTrackerOptsProject({
  id,
  userId,
  cropTrackerOpts,
}: Pick<Project, "id" | "userId" | "cropTrackerOpts">): Promise<Project> {
  const db = await arc.tables();
  const existingProj = await db.project.get({ pk: userId, sk: idToSk(id) });
  
  if (!existingProj) {
    throw Error(`Project ${id} does not exist.`)
  }

  const result = await db.project.put({
    ...existingProj,
    cropTrackerOpts: {
      ...existingProj.cropTrackerOpts,
      ...cropTrackerOpts,
    }
  });
  
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    cropTrackerOpts: result.cropTrackerOpts,
  };
}


export async function addProjectTrackHints({
  id,
  userId,
}: Pick<Project, "id" | "userId">, trackHint: TrackHint): Promise<Project> {
  const db = await arc.tables();
  const existingProj = await db.project.get({ pk: userId, sk: idToSk(id) });
  
  if (!existingProj) {
    throw Error(`Project ${id} does not exist.`)
  }

  const updatedProject = Object.assign({}, existingProj)
  if (!updatedProject.cropTrackerOpts) {
    updatedProject.cropTrackerOpts = {}
  } 
  if (updatedProject.cropTrackerOpts.trackHints) {
    updatedProject.cropTrackerOpts.trackHints.push(trackHint)
  } else {
    updatedProject.cropTrackerOpts.trackHints = [trackHint]
  }
  const result = await db.project.put(updatedProject);
  
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    cropTrackerOpts: result.cropTrackerOpts,
  };
}

export async function updateProjectState({
  id,
  userId,
  state,
}: Pick<Project, "id" | "userId" | "state">): Promise<Project> {
  const db = await arc.tables();
  const existingProj = await db.project.get({ pk: userId, sk: idToSk(id) });
  
  if (!existingProj) {
    throw Error(`Project ${id} does not exist.`)
  }

  const updatedProject = Object.assign({}, existingProj)
  updatedProject.state = state
  const result = await db.project.put(updatedProject);
  
  return {
    id: skToId(result.sk),
    userId: result.pk,
    title: result.title,
    size: result.size,
    state: result.state,
    inputFile: result.inputFile,
    outputFile: result.outputFile,
    cropTrackerOpts: result.cropTrackerOpts,
  };
}


export async function deleteProject({ id, userId }: Pick<Project, "id" | "userId">) {
  const db = await arc.tables();
  return db.project.delete({ pk: userId, sk: idToSk(id) });
}
