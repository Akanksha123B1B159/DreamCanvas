export interface MapRecord {
  key: string;
  value: number;
  workerId: string;
}

export interface ShuffleGroup {
  key: string;
  values: number[];
}

export interface ReduceRecord {
  key: string;
  totalCount: number;
  reducerId: string;
}

export interface MapReduceExecutionTrace {
  inputSize: number;
  rawInput: string[];
  mapOutput: MapRecord[];
  shuffleOutput: ShuffleGroup[];
  reduceOutput: ReduceRecord[];
  executionTimeMs: number;
  explanation: string;
}

export class MapReduceEngine {
  public static defaultDataset = [
    'React', 'Next.js', 'TypeScript', 'JavaScript', 'Tailwind',
    'React', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes',
    'JavaScript', 'React', 'TypeScript', 'GraphQL', 'Redis',
    'SQL', 'PostgreSQL', 'Docker', 'React', 'Next.js',
    'TypeScript', 'JavaScript', 'Docker', 'Redis', 'Python',
    'FastAPI', 'BERT', 'Machine Learning', 'React', 'JavaScript',
    'SQL', 'Redis', 'Docker', 'TypeScript', 'Next.js'
  ];

  public runJob(customDataset?: string[]): MapReduceExecutionTrace {
    const startTime = Date.now();
    const dataset = customDataset && customDataset.length > 0 ? customDataset : MapReduceEngine.defaultDataset;

    // 1. Map Phase (Split across simulated workers W1, W2, W3)
    const mapWorkers = ['Worker-1', 'Worker-2', 'Worker-3'];
    const mapOutput: MapRecord[] = [];

    dataset.forEach((item, index) => {
      const trimmed = item.trim();
      if (!trimmed) return;
      const workerId = mapWorkers[index % mapWorkers.length];
      mapOutput.push({
        key: trimmed,
        value: 1,
        workerId,
      });
    });

    // 2. Shuffle & Sort Phase (Group by key)
    const groupedMap = new Map<string, number[]>();
    mapOutput.forEach((record) => {
      if (!groupedMap.has(record.key)) {
        groupedMap.set(record.key, []);
      }
      groupedMap.get(record.key)!.push(record.value);
    });

    const shuffleOutput: ShuffleGroup[] = Array.from(groupedMap.entries()).map(([key, values]) => ({
      key,
      values,
    }));

    // 3. Reduce Phase (Aggregated by simulated reducers R1, R2)
    const reducers = ['Reducer-1', 'Reducer-2'];
    const reduceOutput: ReduceRecord[] = shuffleOutput.map((group, index) => {
      const totalCount = group.values.reduce((sum, v) => sum + v, 0);
      return {
        key: group.key,
        totalCount,
        reducerId: reducers[index % reducers.length],
      };
    });

    // Sort by count descending
    reduceOutput.sort((a, b) => b.totalCount - a.totalCount);

    const executionTimeMs = Date.now() - startTime;

    return {
      inputSize: dataset.length,
      rawInput: dataset,
      mapOutput,
      shuffleOutput,
      reduceOutput,
      executionTimeMs,
      explanation: `Hadoop MapReduce Paradigm: Distributed the input (${dataset.length} career skill tokens) across 3 Map workers producing (key, 1) pairs. Shuffled and partitioned identical keys into shared buckets. Reducers aggregated counts into final word frequency distributions.`,
    };
  }
}

export const mapReduceEngine = new MapReduceEngine();
