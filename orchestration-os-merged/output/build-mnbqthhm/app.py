from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/users', methods=['GET'])
def get_users():
    users = [{'id': 1, 'name': 'John'}, {'id': 2, 'name': 'Jane'}]
    return jsonify(users)

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    users = [{'id': 1, 'name': 'John'}, {'id': 2, 'name': 'Jane'}]
    user = next((user for user in users if user['id'] == user_id), None)
    if user is None:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user)

if __name__ == '__main__':
    app.run(debug=True)