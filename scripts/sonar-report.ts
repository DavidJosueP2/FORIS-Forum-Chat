const metrics = [
  'software_quality_security_rating', 'software_quality_reliability_rating', 'software_quality_maintainability_rating',
  'security_rating', 'reliability_rating', 'sqale_rating', 'coverage', 'duplicated_lines_density', 'alert_status',
];

try {
  if (!process.env.SONAR_TOKEN) throw new Error('Configura SONAR_TOKEN en .env después de generar un token en SonarQube.');
  const base = process.env.SONAR_HOST_URL || `http://localhost:${process.env.SONAR_PORT || '9000'}`;
  const url = new URL('/api/measures/component', base);
  url.searchParams.set('component', 'messages-sonnar');
  url.searchParams.set('metricKeys', metrics.join(','));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SONAR_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('No se pudo consultar el proyecto. Comprueba el token y ejecuta primero el análisis.');
  const result = await response.json() as { component: { measures: { metric: string; value: string }[] } };
  const values = Object.fromEntries(result.component.measures.map(item => [item.metric, item.value]));
  const ratings: [string, number][] = [
    ['Seguridad', Number(values.software_quality_security_rating ?? values.security_rating)],
    ['Fiabilidad', Number(values.software_quality_reliability_rating ?? values.reliability_rating)],
    ['Mantenibilidad', Number(values.software_quality_maintainability_rating ?? values.sqale_rating)],
  ];
  console.table(Object.fromEntries(ratings.map(([label, value]) => [label, { Nota: ['A', 'B', 'C', 'D', 'E'][value - 1] || 'Pendiente' }])));
  console.info(`Cobertura: ${values.coverage ?? 'pendiente'}%; duplicación: ${values.duplicated_lines_density ?? 'pendiente'}%; Quality Gate: ${values.alert_status ?? 'pendiente'}.`);
  const passed = ratings.every(([, value]) => Number.isInteger(value) && value >= 1 && value <= 2);
  console.info(passed ? 'Las tres calificaciones cumplen el mínimo B.' : 'Todavía no se confirma el mínimo B en las tres calificaciones.');
  if (!passed) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo consultar SonarQube.');
  process.exitCode = 1;
}
