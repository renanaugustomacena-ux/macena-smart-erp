# SmartERP Kubernetes manifests

This directory ships the seven baseline manifests required by the v2.0
Mission I plan (Section 11 — Infrastructure / Operations):

- `deployment.yaml` — backend Deployment (2 replicas, rolling update, non-root)
- `service.yaml` — ClusterIP Service + headless metrics Service
- `ingress.yaml` — TLS Ingress via cert-manager + nginx-ingress
- `configmap.yaml` — non-secret application config
- `secret.yaml` — template for ExternalSecrets / sealed-secrets operator
- `hpa.yaml` — HorizontalPodAutoscaler (min=2, max=10, CPU 70% / Mem 80%)
- `pdb.yaml` — PodDisruptionBudget (minAvailable: 1)

## Apply order

```bash
kubectl create namespace smarterp
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml            # after ExternalSecrets patches it
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
kubectl apply -f pdb.yaml
kubectl apply -f ingress.yaml
```

## Prerequisites

- `cert-manager` with a `letsencrypt-prod` ClusterIssuer
- `nginx-ingress-controller`
- A managed Postgres 16 instance and a managed Redis 7 instance reachable
  at the DNS names encoded in `configmap.yaml`.
- An External-Secrets operator (or Sealed Secrets) wiring the Vault /
  AWS Secrets Manager / Azure Key Vault values into `smarterp-secrets`.

## Not included intentionally

- BullMQ worker Deployment: the backend Deployment runs both the HTTP
  surface and the BullMQ workers in-process. For higher throughput
  extract the workers into a second Deployment using the same image
  with `APP_ROLE=worker` and gate the BullModule in `app.module.ts`.
- Grafana / Prometheus: handled by the central observability namespace
  via the ServiceMonitor declared in `service.yaml`.
