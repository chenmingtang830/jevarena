export function PolicyContact(){
  const operator="Richard Tang";
  const email="richard@learnest.org";
  return operator && email ? <section><h2>Operator and contact</h2><p>An independent open-source project operated by <a href="https://x.com/richardt830" rel="noreferrer">{operator} (@richardt830)</a>. For privacy or deletion requests, email <a href={`mailto:${email}`}>{email}</a>. Do not send API keys. Use GitHub for public bugs and discussions, never private tasks or deletion receipts.</p></section> : <p role="note">Draft pending operator confirmation: the operator name and private contact channel must be supplied before this policy is published as final.</p>;
}
