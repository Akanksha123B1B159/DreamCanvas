# Kubernetes Orchestration Guide for DreamCanvas

This document explains the containerization and Kubernetes orchestration architecture for **DreamCanvas**, detailing how distributed services run, scale, and heal in production.

---

## 1. Architectural Concepts

| Concept | Definition & DreamCanvas Mapping |
| :--- | :--- |
| **Container** | Standardized, isolated execution unit containing application code and runtime dependencies (e.g. Next.js Node container, FastAPI Python container, Redis Alpine). |
| **Pod** | Smallest deployable Kubernetes computing unit containing one or more co-located containers sharing network namespace and storage volumes. |
| **Deployment** | Declarative controller managing desired replica counts, rolling updates, rollbacks, and replica sets (e.g. `frontend-deployment` with 2 replicas). |
| **Service** | Stable network abstraction (virtual IP and DNS name) load-balancing traffic across ephemeral Pods (e.g. `ml-service.dreamcanvas.svc.cluster.local:8000`). |
| **ConfigMap** | Non-confidential environment configuration decoupled from image builds (`k8s/configmap.yaml`). |
| **Secret** | Base64-encoded confidential credentials such as Supabase keys, Groq API keys, and JWT secrets (`k8s/secrets.example.yaml`). |
| **Self-Healing** | Liveness and readiness probes automatically restart unhealthy containers and remove failing instances from service traffic. |
| **Horizontal Autoscaling** | HPA automatically scales pod replica counts from 2 to 10 based on CPU or memory thresholds during student recruitment surges. |

---

## 2. Manifest Directory Structure

```text
k8s/
├── namespace.yaml           # Isolates the 'dreamcanvas' cluster workspace
├── configmap.yaml           # Environment configuration (ports, URLs, models)
├── secrets.example.yaml     # Secrets template (Supabase, Groq, YouTube keys)
├── frontend-deployment.yaml # Next.js frontend with 2 replicas and health probes
├── frontend-service.yaml    # LoadBalancer routing public HTTP traffic
├── ml-deployment.yaml       # FastAPI ML BERT+SVM prediction deployment
├── ml-service.yaml          # ClusterIP internal service on port 8000
├── redis-deployment.yaml    # Redis message broker deployment
└── redis-service.yaml       # ClusterIP internal service on port 6379
```

---

## 3. Local Cluster Deployment (Minikube or Docker Desktop)

### Prerequisites
- Docker Desktop with Kubernetes enabled, or [Minikube](https://minikube.sigs.k8s.io/)
- `kubectl` CLI installed

### Step-by-Step Deployment

1. **Create the dedicated namespace:**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```

2. **Configure secrets:**
   ```bash
   cp k8s/secrets.example.yaml k8s/secrets.yaml
   # Fill in your real API keys in k8s/secrets.yaml
   kubectl apply -f k8s/secrets.yaml
   ```

3. **Apply cluster configuration:**
   ```bash
   kubectl apply -f k8s/configmap.yaml
   ```

4. **Deploy microservices and internal services:**
   ```bash
   kubectl apply -f k8s/redis-deployment.yaml
   kubectl apply -f k8s/redis-service.yaml
   kubectl apply -f k8s/ml-deployment.yaml
   kubectl apply -f k8s/ml-service.yaml
   kubectl apply -f k8s/frontend-deployment.yaml
   kubectl apply -f k8s/frontend-service.yaml
   ```

5. **Verify running pods and services:**
   ```bash
   kubectl get pods -n dreamcanvas
   kubectl get services -n dreamcanvas
   ```

6. **Access DreamCanvas:**
   ```bash
   # If running Minikube:
   minikube service frontend-service -n dreamcanvas
   # Or port-forward directly:
   kubectl port-forward svc/frontend-service 3000:80 -n dreamcanvas
   ```

---

## 4. Testing Fault Tolerance & Self-Healing

Simulate a pod crash to witness Kubernetes automatic self-healing:
```bash
# Delete a running frontend or ML pod:
kubectl delete pod -l app=dreamcanvas-ml -n dreamcanvas --now

# Observe the Deployment immediately launching a fresh replacement replica:
kubectl get pods -n dreamcanvas -w
```
