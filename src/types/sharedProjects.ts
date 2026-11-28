/**
    * Shared Creator Projects Interface
    * Persistent project system that future applications can reference.
    */
export interface EcosystemProject {
  id: string;
  userId: string;
  name: string;
  objective: string;
  description: string;
  status: "active" | "completed" | "archived";
  associatedAppIds: string[]; // e.g. ["threadsworks", "productworks"]
  createdAt: string;
  updatedAt: string;
}
