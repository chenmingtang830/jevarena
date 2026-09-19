export function PolicyContact(){
  const operator="Richard Tang";
  const email="richard@learnest.org";
  return operator && email ? <section><h2>Operator and contact</h2><p>Operated by {operator}. For privacy requests, account deletion, or questions about these terms, email <a href={`mailto:${email}`}>{email}</a>. Do not send API keys. GitHub is for public bugs and discussions, not private tasks or deletion receipts.</p></section> : <p role="note">Draft pending operator confirmation: the operator name and private contact channel must be supplied before this policy is published as final.</p>;
}
