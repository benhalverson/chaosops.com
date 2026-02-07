using UnityEngine;
using System;

[Serializable]
public class TaskSpec
{
    public string taskId;
    public string worldId;
    public int seed;
    public Pose startPose;
    public Pose goalPose;
    public Constraints constraints;
    public SuccessConditions success;
}

[Serializable]
public class Pose
{
    public float x;
    public float y;
    public float yaw;
}

[Serializable]
public class Constraints
{
    public Polygon[] noGoZones;
}

[Serializable]
public class Polygon
{
    public Vector2[] points;
}

[Serializable]
public class SuccessConditions
{
    public float maxTimeSec;
    public int maxCollisions;
}

[Serializable]
public class FaultProfile
{
    public string profileId;
    public Fault[] faults;
}

[Serializable]
public class Fault
{
    public float atSec;
    public string type;
    public float durationSec;
    public float severity;
    public string target;
}

public class SimulationManager : MonoBehaviour
{
    public static SimulationManager Instance { get; private set; }

    [Header("Configuration")]
    public string runId;
    public TaskSpec taskSpec;
    public FaultProfile faultProfile;

    [Header("Runtime")]
    public SimulationState state = SimulationState.Idle;
    public float simTime = 0f;
    public int collisionCount = 0;

    private RobotController robot;
    private FaultInjector faultInjector;
    private EventEmitter eventEmitter;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        Debug.Log("[SimManager] Awake");
    }

    void Start()
    {
        Debug.Log("[SimManager] Start");

        // Initialize deterministic random
        if (taskSpec != null && taskSpec.seed != 0)
        {
            UnityEngine.Random.InitState(taskSpec.seed);
            Debug.Log($"[SimManager] Initialized with seed: {taskSpec.seed}");
        }

        // Set fixed timestep for determinism
        Time.fixedDeltaTime = 0.02f; // 50 FPS physics

        robot = FindObjectOfType<RobotController>();
        faultInjector = GetComponent<FaultInjector>();
        eventEmitter = GetComponent<EventEmitter>();

        // Try to load config from JavaScript bridge (WebGL)
#if UNITY_WEBGL && !UNITY_EDITOR
        LoadConfigFromWeb();
#else
        // Auto-start in editor/standalone for testing
        StartRun();
#endif
    }

    public void StartRun()
    {
        if (state != SimulationState.Idle) return;

        // Create the run in backend first
        StartCoroutine(CreateRunInBackend());
    }

    private IEnumerator CreateRunInBackend()
    {
        string url = $"{eventEmitter.backendUrl}/api/runs";
        var requestBody = new
        {
            taskSpec = taskSpec,
            faultProfile = faultProfile
        };
        string json = JsonUtility.ToJson(requestBody);

        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[SimManager] Failed to create run: {request.error}");
                yield break;
            }

            // Parse response to get the actual runId from backend
            var response = JsonUtility.FromJson<RunResponse>(request.downloadHandler.text);
            runId = response.id;
            Debug.Log($"[SimManager] Run created with ID: {runId}");
        }

        // Now start the actual simulation
        StartRunInternal();
    }

    private void StartRunInternal()
    {

        state = SimulationState.Running;
        simTime = 0f;
        collisionCount = 0;

        // Position robot at start
        if (robot != null && taskSpec != null)
        {
            robot.transform.position = new Vector3(taskSpec.startPose.x, taskSpec.startPose.y, 0);
            robot.transform.rotation = Quaternion.Euler(0, 0, taskSpec.startPose.yaw);
            robot.SetGoal(new Vector3(taskSpec.goalPose.x, taskSpec.goalPose.y, 0));
        }

        // Initialize fault injector
        if (faultInjector != null && faultProfile != null)
        {
            faultInjector.Initialize(faultProfile);
        }

        // Emit run.started event
        if (eventEmitter != null)
        {
            eventEmitter.EmitRunStarted(runId, taskSpec);
        }

        Debug.Log($"[SimManager] Run started: {runId}");
    }

    [System.Serializable]
    private class RunResponse
    {
        public string id;
    }

    void FixedUpdate()
    {
        if (state != SimulationState.Running) return;

        simTime += Time.fixedDeltaTime;

        // Check timeout
        if (taskSpec != null && simTime >= taskSpec.success.maxTimeSec)
        {
            EndRun(RunResult.Timeout);
            return;
        }

        // Check collision limit
        if (taskSpec != null && collisionCount > taskSpec.success.maxCollisions)
        {
            EndRun(RunResult.TooManyCollisions);
            return;
        }

        // Check if goal reached
        if (robot != null && taskSpec != null)
        {
            float distToGoal = Vector3.Distance(
                robot.transform.position,
                new Vector3(taskSpec.goalPose.x, taskSpec.goalPose.y, 0)
            );

            if (distToGoal < 0.5f) // Goal threshold
            {
                EndRun(RunResult.Success);
                return;
            }
        }

        // Emit state.pose periodically (every 0.1s = 10 Hz)
        if (Mathf.Approximately(simTime % 0.1f, 0f))
        {
            EmitPose();
        }
    }

    public void OnCollision()
    {
        collisionCount++;
        if (eventEmitter != null)
        {
            eventEmitter.EmitViolation(runId, simTime, "collision", new { count = collisionCount });
        }
    }

    public void OnNoGoZoneEntered()
    {
        if (eventEmitter != null)
        {
            eventEmitter.EmitViolation(runId, simTime, "no_go_zone", new { });
        }
        EndRun(RunResult.ConstraintViolation);
    }

    private void EmitPose()
    {
        if (robot == null || eventEmitter == null) return;

        var pose = new
        {
            x = robot.transform.position.x,
            y = robot.transform.position.y,
            yaw = robot.transform.rotation.eulerAngles.z,
            v = robot.CurrentVelocity
        };

        eventEmitter.EmitPose(runId, simTime, pose);
    }

    private void EndRun(RunResult result)
    {
        if (state != SimulationState.Running) return;

        state = SimulationState.Completed;

        var summary = new
        {
            result = result.ToString(),
            totalTime = simTime,
            collisions = collisionCount,
            goalReached = result == RunResult.Success
        };

        if (eventEmitter != null)
        {
            eventEmitter.EmitRunEnded(runId, simTime, summary);
        }

        Debug.Log($"[SimManager] Run ended: {result}");
    }

    // Called from JavaScript (WebGL)
    public void LoadConfigFromJS(string json)
    {
        try
        {
            var config = JsonUtility.FromJson<RunConfig>(json);
            runId = config.runId;
            taskSpec = config.taskSpec;
            faultProfile = config.faultProfile;

            Debug.Log($"[SimManager] Config loaded from JS: {runId}");
            
            // Auto-start if configured
            if (config.autoStart)
            {
                StartRun();
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[SimManager] Failed to parse config: {e.Message}");
        }
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    private void LoadConfigFromWeb()
    {
        // Request config from Angular
        Application.ExternalCall("onUnityReady");
    }
#endif
}

[Serializable]
public class RunConfig
{
    public string runId;
    public TaskSpec taskSpec;
    public FaultProfile faultProfile;
    public bool autoStart;
}

public enum SimulationState
{
    Idle,
    Running,
    Paused,
    Completed
}

public enum RunResult
{
    Success,
    Timeout,
    TooManyCollisions,
    ConstraintViolation
}
