import type { V2_MetaFunction } from "@remix-run/node";
import { useUser } from "~/utils";
import { Input } from '@mantine/core';
// import { IconAt } from '@tabler/icons-react';

export const meta: V2_MetaFunction = () => [{ title: "Clips - New Project" }];

export default function ProjectsPage() {
  const user = useUser();

  return (
    <div className="flex h-full w-full justify-center">
      <div className="h-full w-full max-w-lg bg-gray-50">
        <Input
            placeholder="Your email"
        />
      </div>
    </div>
  );
}
