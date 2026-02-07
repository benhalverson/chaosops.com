using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    [Header("Target")]
    public Transform target;
    
    [Header("Settings")]
    public float smoothSpeed = 5f;
    public Vector3 offset = new Vector3(0, 0, -10);
    public float minOrthoSize = 5f;
    public float maxOrthoSize = 20f;
    public float zoomSpeed = 2f;
    
    private Camera cam;
    private Vector3 velocity = Vector3.zero;

    void Start()
    {
        cam = GetComponent<Camera>();
        if (cam == null)
        {
            cam = Camera.main;
        }

        // Find robot if target not set
        if (target == null)
        {
            var robot = FindObjectOfType<RobotController>();
            if (robot != null)
            {
                target = robot.transform;
                Debug.Log("[CameraFollow] Auto-found robot target");
            }
        }

        // Set initial position
        if (target != null)
        {
            transform.position = target.position + offset;
        }
    }

    void LateUpdate()
    {
        if (target == null) return;

        // Smooth follow
        Vector3 desiredPosition = target.position + offset;
        transform.position = Vector3.SmoothDamp(transform.position, desiredPosition, ref velocity, 1f / smoothSpeed);

        // Keep camera orthographic size reasonable
        if (cam != null && cam.orthographic)
        {
            cam.orthographicSize = Mathf.Clamp(cam.orthographicSize, minOrthoSize, maxOrthoSize);
        }
    }

    // Optional: Adjust zoom based on distance to goal
    public void SetZoomForDistance(float distance)
    {
        if (cam == null || !cam.orthographic) return;
        
        float targetSize = Mathf.Lerp(minOrthoSize, maxOrthoSize, distance / 50f);
        cam.orthographicSize = Mathf.Lerp(cam.orthographicSize, targetSize, Time.deltaTime * zoomSpeed);
    }
}
