using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Networking;

[System.Serializable]
public class SimEvent
{
    public string runId;
    public int seq;
    public float t;
    public string type;
    public string payload; // JSON string
}

[System.Serializable]
public class EventBatchPayload
{
    public int seq;
    public float t;
    public string type;
    public string payload;
}

[System.Serializable]
public class EventBatch
{
    public EventBatchPayload[] items;
}

public class EventEmitter : MonoBehaviour
{
    [Header("Configuration")]
    public string backendUrl = "http://localhost:3000";
    public bool useBatching = true;
    public int batchSize = 10;
    public float batchIntervalSeconds = 1f;

    private int eventSequence = 0;
    private List<SimEvent> eventBatch = new List<SimEvent>();
    private float lastBatchTime = 0f;

    void Start()
    {
        Debug.Log("[EventEmitter] Start");
#if UNITY_WEBGL && !UNITY_EDITOR
        // In WebGL, get backend URL from JavaScript
        LoadBackendUrl();
#endif
    }

    void Update()
    {
        if (useBatching && eventBatch.Count > 0)
        {
            if (Time.time - lastBatchTime >= batchIntervalSeconds || eventBatch.Count >= batchSize)
            {
                FlushBatch();
            }
        }
    }

    public void EmitRunStarted(string runId, TaskSpec taskSpec)
    {
        var payload = new
        {
            taskId = taskSpec.taskId,
            seed = taskSpec.seed,
            worldId = taskSpec.worldId
        };
        EmitEvent(runId, "run.started", payload);
    }

    public void EmitPose(string runId, float t, object poseData)
    {
        EmitEvent(runId, "state.pose", poseData, t);
    }

    public void EmitFaultInjected(string runId, float t, object faultData)
    {
        EmitEvent(runId, "fault.injected", faultData, t);
    }

    public void EmitViolation(string runId, float t, string violationType, object data)
    {
        EmitEvent(runId, $"violation.{violationType}", data, t);
    }

    public void EmitRunEnded(string runId, float t, object summary)
    {
        EmitEvent(runId, "run.ended", summary, t);
        
        // Flush any remaining events
        if (useBatching)
        {
            FlushBatch();
        }
    }

    private void EmitEvent(string runId, string eventType, object payload, float? t = null)
    {
        var simEvent = new SimEvent
        {
            runId = runId,
            seq = eventSequence++,
            t = t ?? SimulationManager.Instance?.simTime ?? 0f,
            type = eventType,
            payload = JsonUtility.ToJson(payload)
        };

        if (useBatching)
        {
            eventBatch.Add(simEvent);
        }
        else
        {
            SendEvent(simEvent);
        }
    }

    private void FlushBatch()
    {
        if (eventBatch.Count == 0) return;

        SendEventBatch(eventBatch.ToArray());
        eventBatch.Clear();
        lastBatchTime = Time.time;
    }

    private void SendEvent(SimEvent simEvent)
    {
        StartCoroutine(PostEventToBackend(simEvent));
    }

    private void SendEventBatch(SimEvent[] events)
    {
        StartCoroutine(PostEventBatchToBackend(events));
    }

    private IEnumerator PostEventToBackend(SimEvent simEvent)
    {
        string url = $"{backendUrl}/api/runs/{simEvent.runId}/events";
        string json = JsonUtility.ToJson(simEvent);

        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[EventEmitter] Failed to send event: {request.error}");
            }
        }
    }

    private IEnumerator PostEventBatchToBackend(SimEvent[] events)
    {
        if (events.Length == 0) yield break;

        string runId = events[0].runId;
        string url = $"{backendUrl}/api/runs/{runId}/events";

        // Create serializable batch
        var batch = new EventBatch
        {
            items = new EventBatchPayload[events.Length]
        };

        for (int i = 0; i < events.Length; i++)
        {
            batch.items[i] = new EventBatchPayload
            {
                seq = events[i].seq,
                t = events[i].t,
                type = events[i].type,
                payload = events[i].payload
            };
        }

        string json = JsonUtility.ToJson(batch);
        Debug.Log($"[EventEmitter] Sending batch of {events.Length} events: {json}");

        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[EventEmitter] Failed to send batch: {request.error}");
            }
            else
            {
                Debug.Log($"[EventEmitter] Sent batch of {events.Length} events");
            }
        }
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    private void LoadBackendUrl()
    {
        // Will be set from JavaScript
        Application.ExternalCall("getBackendUrl");
    }

    public void SetBackendUrl(string url)
    {
        backendUrl = url;
        Debug.Log($"[EventEmitter] Backend URL set to: {url}");
    }
#endif
}
