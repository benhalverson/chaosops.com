using UnityEngine;
using System.Collections.Generic;
using System.Linq;

public class FaultInjector : MonoBehaviour
{
    private FaultProfile profile;
    private RobotController robot;
    private EventEmitter eventEmitter;
    private List<ActiveFault> activeFaults = new List<ActiveFault>();

    void Start()
    {
        robot = FindObjectOfType<RobotController>();
        eventEmitter = GetComponent<EventEmitter>();
    }

    public void Initialize(FaultProfile faultProfile)
    {
        profile = faultProfile;
        activeFaults.Clear();
        Debug.Log($"[FaultInjector] Initialized with {faultProfile.faults.Length} faults");
    }

    void FixedUpdate()
    {
        if (profile == null || SimulationManager.Instance == null) return;
        if (SimulationManager.Instance.state != SimulationState.Running) return;

        float simTime = SimulationManager.Instance.simTime;

        // Check for faults to activate
        foreach (var fault in profile.faults)
        {
            // Check if fault should be triggered
            if (Mathf.Approximately(simTime, fault.atSec) || 
                (simTime > fault.atSec && simTime < fault.atSec + Time.fixedDeltaTime))
            {
                ActivateFault(fault, simTime);
            }
        }

        // Update active faults and deactivate expired ones
        for (int i = activeFaults.Count - 1; i >= 0; i--)
        {
            var activeFault = activeFaults[i];
            if (simTime >= activeFault.endTime)
            {
                DeactivateFault(activeFault);
                activeFaults.RemoveAt(i);
            }
        }
    }

    private void ActivateFault(Fault fault, float simTime)
    {
        if (activeFaults.Any(f => f.fault == fault)) return; // Already active

        var activeFault = new ActiveFault
        {
            fault = fault,
            startTime = simTime,
            endTime = simTime + fault.durationSec
        };

        activeFaults.Add(activeFault);

        // Apply fault to robot
        if (robot != null)
        {
            switch (fault.type)
            {
                case "sensor_dropout":
                    robot.ApplySensorDropout(false);
                    break;
                
                case "wheel_slip":
                    robot.ApplyWheelSlip(fault.severity);
                    break;
                
                case "latency_spike":
                    robot.ApplyLatencySpike(fault.severity);
                    break;
                
                default:
                    Debug.LogWarning($"[FaultInjector] Unknown fault type: {fault.type}");
                    break;
            }
        }

        // Emit fault.injected event
        if (eventEmitter != null)
        {
            var payload = new
            {
                type = fault.type,
                severity = fault.severity,
                durationSec = fault.durationSec,
                target = fault.target
            };
            eventEmitter.EmitFaultInjected(
                SimulationManager.Instance.runId,
                simTime,
                payload
            );
        }

        Debug.Log($"[FaultInjector] Activated fault: {fault.type} at t={simTime}s");
    }

    private void DeactivateFault(ActiveFault activeFault)
    {
        // Restore robot to normal
        if (robot != null)
        {
            switch (activeFault.fault.type)
            {
                case "sensor_dropout":
                    robot.ApplySensorDropout(true);
                    break;
                
                case "wheel_slip":
                case "latency_spike":
                    robot.ClearFaults();
                    break;
            }
        }

        Debug.Log($"[FaultInjector] Deactivated fault: {activeFault.fault.type}");
    }

    private class ActiveFault
    {
        public Fault fault;
        public float startTime;
        public float endTime;
    }
}
