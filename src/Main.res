module User = {
  module Get = {
    module Definition = %graphql(`
      query Identity {
        me {
          id
          displayName
        }
      }
    `)

    let useQuery = () => {
      let (full, op) = ReScriptUrql.Hooks.useQuery(~query=module(Definition), ());
      (full.response, full, op)
    }
  }
}


@gentype("Main")
@react.component
let make = () =>  {
  let (response, _, _) = User.Get.useQuery();

  switch(response){
   | Data({me: Some(me)}) => 
      <main className="text-red-500"> {React.string(me.displayName)} </main>
   | _ => <span>{React.string("Loading...")}</span>
  }
}
