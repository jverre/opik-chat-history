import axios from 'axios';
import { TraceData } from './interface';

export function logTracesToOpik(apiKey: string, traces: TraceData[]) {
    if (traces.length == 0) return;
    
    axios.post(
        "https://www.comet.com/opik/api/v1/private/traces/batch",
        {
            "traces": traces
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'authorization': `${apiKey}`,
                'Comet-Workspace': 'jacques-comet'
            },
            timeout: 1000
        }
    ).then((response) => {
        console.log(response.data);
    }).catch((error) => {
        console.error(error);
    })
}