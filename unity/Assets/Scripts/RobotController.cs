using UnityEngine;
using System.Collections.Generic;

public class RobotController : MonoBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 2f;
    public float rotationSpeed = 180f;
    public float waypointThreshold = 0.3f;

    [Header("Navigation")]
    public Vector3 goalPosition;
    private List<Vector3> path = new List<Vector3>();
    private int currentWaypointIndex = 0;

    [Header("State")]
    public float CurrentVelocity { get; private set; }
    
    private bool hasGoal = false;

    private Rigidbody rb3d;
    private Rigidbody2D rb2d;

    // Fault-affected values
    private float velocityMultiplier = 1f;
    private bool sensorActive = true;
    private float controlLatency = 0f;

    void Awake()
    {
        Debug.Log("[Robot] Awake");

        rb2d = GetComponent<Rigidbody2D>();
        rb3d = GetComponent<Rigidbody>();

        if (rb2d == null && rb3d == null)
        {
            // Prefer 2D if a 2D collider exists, otherwise use 3D
            if (GetComponent<Collider2D>() != null)
            {
                rb2d = gameObject.AddComponent<Rigidbody2D>();
                rb2d.gravityScale = 0; // Top-down, no gravity
                rb2d.drag = 2f;
                rb2d.angularDrag = 5f;
            }
            else
            {
                rb3d = gameObject.AddComponent<Rigidbody>();
                rb3d.useGravity = false;
                rb3d.drag = 2f;
                rb3d.angularDrag = 5f;
                rb3d.constraints = RigidbodyConstraints.FreezePositionZ |
                                   RigidbodyConstraints.FreezeRotationX |
                                   RigidbodyConstraints.FreezeRotationY;
            }
        }
    }

    void FixedUpdate()
    {
        if (!hasGoal) return;

        if (path.Count == 0)
        {
            // Direct navigation (no obstacles for MVP)
            path.Add(goalPosition);
        }

        if (currentWaypointIndex >= path.Count)
        {
            // Reached final waypoint
            CurrentVelocity = 0f;
            if (rb2d != null)
            {
                rb2d.linearVelocity = Vector2.zero;
            }
            else if (rb3d != null)
            {
                rb3d.velocity = Vector3.zero;
            }
            return;
        }

        Vector3 targetWaypoint = path[currentWaypointIndex];
        Vector3 direction = (targetWaypoint - transform.position).normalized;

        // Check if reached current waypoint
        if (Vector3.Distance(transform.position, targetWaypoint) < waypointThreshold)
        {
            currentWaypointIndex++;
            return;
        }

        // Apply fault effects
        float effectiveSpeed = moveSpeed * velocityMultiplier;
        
        if (!sensorActive)
        {
            // Blind navigation - just move forward
            direction = transform.up;
        }

        // Rotate towards target
        float targetAngle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg - 90f;
        float currentAngle = transform.rotation.eulerAngles.z;
        float angleDiff = Mathf.DeltaAngle(currentAngle, targetAngle);

        float rotationStep = rotationSpeed * Time.fixedDeltaTime;
        if (Mathf.Abs(angleDiff) > 5f)
        {
            // Still rotating, slow down
            effectiveSpeed *= 0.3f;
            float newAngle = currentAngle + Mathf.Clamp(angleDiff, -rotationStep, rotationStep);
            transform.rotation = Quaternion.Euler(0, 0, newAngle);
        }

        // Move forward
        Vector2 velocity = (Vector2)transform.up * effectiveSpeed;
        
        // Add wheel slip noise if affected by fault
        if (velocityMultiplier < 1f)
        {
            velocity += Random.insideUnitCircle * 0.5f;
        }

        if (rb2d != null)
        {
            rb2d.linearVelocity = velocity;
        }
        else if (rb3d != null)
        {
            rb3d.velocity = new Vector3(velocity.x, velocity.y, 0f);
        }
        CurrentVelocity = velocity.magnitude;
    }

    public void SetGoal(Vector3 goal)
    {
        goalPosition = goal;
        hasGoal = true;
        currentWaypointIndex = 0;
        path.Clear();
        
        // Simple direct path (A* can be added later)
        path.Add(goal);
        
        Debug.Log($"[Robot] Goal set: {goal}");
    }

    // Fault injection methods
    public void ApplyWheelSlip(float severity)
    {
        velocityMultiplier = Mathf.Clamp01(1f - severity);
        Debug.Log($"[Robot] Wheel slip applied: {severity}");
    }

    public void ApplySensorDropout(bool active)
    {
        sensorActive = active;
        Debug.Log($"[Robot] Sensor active: {active}");
    }

    public void ApplyLatencySpike(float latencySeconds)
    {
        controlLatency = latencySeconds;
        Debug.Log($"[Robot] Latency spike: {latencySeconds}s");
    }

    public void ClearFaults()
    {
        velocityMultiplier = 1f;
        sensorActive = true;
        controlLatency = 0f;
    }

    void OnCollisionEnter2D(Collision2D collision)
    {
        HandleCollision(collision.gameObject);
    }

    void OnCollisionEnter(Collision collision)
    {
        HandleCollision(collision.gameObject);
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        HandleTrigger(other.gameObject);
    }

    void OnTriggerEnter(Collider other)
    {
        HandleTrigger(other.gameObject);
    }

    private void HandleCollision(GameObject other)
    {
        if (SimulationManager.Instance != null)
        {
            SimulationManager.Instance.OnCollision();
        }
        Debug.Log($"[Robot] Collision with {other.name}");
    }

    private void HandleTrigger(GameObject other)
    {
        if (other.CompareTag("NoGoZone"))
        {
            if (SimulationManager.Instance != null)
            {
                SimulationManager.Instance.OnNoGoZoneEntered();
            }
            Debug.Log("[Robot] Entered no-go zone!");
        }
    }
}
