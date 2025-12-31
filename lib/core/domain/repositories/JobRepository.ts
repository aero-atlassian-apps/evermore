export interface Job {
    id: string;
    type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    payload: any;
    result?: any;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export interface JobRepository {
    create(type: string, payload: any): Promise<Job>;
    findById(id: string): Promise<Job | null>;
    findPending(type?: string, limit?: number): Promise<Job[]>;
    updateStatus(id: string, status: Job['status'], result?: any, error?: string, updatedPayload?: any): Promise<Job>;
}
