from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello World'

@app.route('/api/data')
def get_data():
    data = {'message': 'Hello from Flask API'}
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)