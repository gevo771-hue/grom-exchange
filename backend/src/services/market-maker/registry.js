let service = null;

export function setMarketMakerService(instance) {
  service = instance;
}

export function getMarketMakerService() {
  return service;
}
