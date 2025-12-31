export interface MemoryEntity {
  name: string;
  type: string;
  mentions?: number;
}

export interface Memory {
  text: string;
  timestamp: string | Date;
  entities?: MemoryEntity[];
  id?: string;
}
