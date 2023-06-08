import { useOptionalUser } from "~/utils";

export default function IndexPage() {
  const user = useOptionalUser();
  return (
    <iframe
      src="https://docs.google.com/forms/d/e/1FAIpQLSexXwj2X1B0vRCG810aTXGtriUvYchjyRjkzLzuhSSufTJRlg/viewform?embedded=true"
      width="100%"
      height="100%"
      frameborder="0"
      marginheight="0"
      marginwidth="0"
    >
      Loading…
    </iframe>
  );
}
